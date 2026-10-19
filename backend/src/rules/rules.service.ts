import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../common/redis/redis.service';
import {
  RuleEvaluationResult,
  AstNode,
  CreateComplianceRuleDto,
  UpdateComplianceRuleDto,
} from '@healthclaim/shared';
import { RuleAstCompiler } from './parser/rule-ast.compiler';

export interface EvaluationCandidate extends Record<string, any> {
  category: string;
  totalAmount: number;
  hospitalName: string;
  hospitalGrade?: string | null;
  items: {
    description: string;
    category: string;
    unitPrice: number;
    quantity: number;
    totalPrice: number;
  }[];
  userQuota?: {
    remainingBalance: number;
    annualLimit: number;
    cumulativeDeductibleSpent: number;
  };
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);
  private static readonly CACHE_KEY_ACTIVE_RULES = 'healthclaim:rules:active';

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly redis?: RedisService,
  ) {}

  /**
   * Evaluates a claim candidate against active compliance rules.
   * Leverages Redis in-memory cache for hot AST rule definitions.
   * @param bypassCache If true, bypasses Redis and forces direct DB query (for k6 cache ablation benchmark)
   */
  async evaluateCandidate(
    candidate: EvaluationCandidate,
    bypassCache = false,
  ): Promise<{
    allPassed: boolean;
    results: RuleEvaluationResult[];
  }> {
    let rules: any[] | null = null;

    if (!bypassCache && this.redis) {
      rules = await this.redis.get<any[]>(RuleEngineService.CACHE_KEY_ACTIVE_RULES);
    }

    if (!rules) {
      rules = await this.prisma.complianceRule.findMany({
        where: { isActive: true },
        orderBy: { priority: 'asc' },
      });

      if (!bypassCache && this.redis) {
        await this.redis.set(RuleEngineService.CACHE_KEY_ACTIVE_RULES, rules, 3600);
      }
    }

    const results: RuleEvaluationResult[] = [];
    let allPassed = true;

    for (const rule of rules) {
      try {
        const spec = RuleAstCompiler.compile(rule.astDefinition as unknown as AstNode);
        const evalResult = spec.isSatisfiedBy(candidate);

        results.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          isPassed: evalResult.isPassed,
          reason: evalResult.reason,
          details: evalResult.details,
        });

        if (!evalResult.isPassed) {
          allPassed = false;
        }
      } catch (error: any) {
        this.logger.error(`Error evaluating rule ${rule.code}: ${error.message}`, error.stack);
        results.push({
          ruleId: rule.id,
          ruleCode: rule.code,
          ruleName: rule.name,
          isPassed: false,
          reason: `Engine Evaluation Error: ${error.message}`,
        });
        allPassed = false;
      }
    }

    return { allPassed, results };
  }

  /**
   * Retrieves all compliance rules.
   */
  async getAllRules() {
    return this.prisma.complianceRule.findMany({
      orderBy: { priority: 'asc' },
    });
  }

  /**
   * Create a new compliance rule with AST logic
   */
  async createRule(dto: CreateComplianceRuleDto, actorId: string) {
    const existing = await this.prisma.complianceRule.findUnique({
      where: { code: dto.code.toUpperCase().trim() },
    });
    if (existing) {
      throw new ConflictException('A compliance rule with this code already exists');
    }

    // Validate AST compiler compiles without error
    RuleAstCompiler.compile(dto.astDefinition);

    const count = await this.prisma.complianceRule.count();
    const priority = dto.priority ?? (count + 1) * 10;

    const rule = await this.prisma.complianceRule.create({
      data: {
        code: dto.code.toUpperCase().trim(),
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        priority,
        astDefinition: dto.astDefinition as any,
        isActive: dto.isActive ?? true,
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'CREATE_COMPLIANCE_RULE',
        targetResource: 'COMPLIANCE_RULE',
        targetResourceId: rule.id,
        details: { code: rule.code, name: rule.name, priority },
      },
    });

    await this.invalidateCache();
    return rule;
  }

  /**
   * Update an existing compliance rule
   */
  async updateRule(id: string, dto: UpdateComplianceRuleDto, actorId: string) {
    const existing = await this.prisma.complianceRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Compliance rule not found');
    }

    if (dto.astDefinition) {
      RuleAstCompiler.compile(dto.astDefinition);
    }

    const updated = await this.prisma.complianceRule.update({
      where: { id },
      data: {
        ...(dto.name ? { name: dto.name.trim() } : {}),
        ...(dto.description !== undefined ? { description: dto.description?.trim() || null } : {}),
        ...(dto.priority !== undefined ? { priority: dto.priority } : {}),
        ...(dto.astDefinition ? { astDefinition: dto.astDefinition as any } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'UPDATE_COMPLIANCE_RULE',
        targetResource: 'COMPLIANCE_RULE',
        targetResourceId: id,
        details: { code: existing.code, changes: dto },
      },
    });

    await this.invalidateCache();
    return updated;
  }

  /**
   * Reorder compliance rules execution sequence
   */
  async reorderRules(ruleIds: string[], actorId: string) {
    const updates = ruleIds.map((id, index) =>
      this.prisma.complianceRule.update({
        where: { id },
        data: { priority: (index + 1) * 10 },
      }),
    );

    await this.prisma.$transaction(updates);

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'REORDER_COMPLIANCE_RULES',
        targetResource: 'COMPLIANCE_RULE',
        details: { count: ruleIds.length, orderedRuleIds: ruleIds },
      },
    });

    await this.invalidateCache();
    return this.getAllRules();
  }

  /**
   * Delete a compliance rule
   */
  async deleteRule(id: string, actorId: string) {
    const rule = await this.prisma.complianceRule.findUnique({ where: { id } });
    if (!rule) {
      throw new NotFoundException('Compliance rule not found');
    }

    await this.prisma.complianceRule.delete({ where: { id } });

    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'DELETE_COMPLIANCE_RULE',
        targetResource: 'COMPLIANCE_RULE',
        targetResourceId: id,
        details: { code: rule.code, name: rule.name },
      },
    });

    await this.invalidateCache();
    return { message: `Compliance rule "${rule.name}" deleted successfully` };
  }

  /**
   * Manually invalidate cached active rules (e.g. for testing or external sync)
   */
  async invalidateCache(): Promise<void> {
    if (this.redis) {
      await this.redis.del(RuleEngineService.CACHE_KEY_ACTIVE_RULES);
      this.logger.debug(`Invalidated cache key: ${RuleEngineService.CACHE_KEY_ACTIVE_RULES}`);
    }
  }

  /**
   * Expose cache metrics for k6 performance reporting
   */
  getCacheMetrics() {
    return this.redis?.getMetrics() ?? { connected: false, hits: 0, misses: 0, totalRequests: 0, hitRatio: 0 };
  }
}
