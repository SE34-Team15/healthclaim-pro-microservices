import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { RuleEngineService } from './rules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../auth/decorators/current-user.decorator';
import {
  UserRole,
  CreateComplianceRuleDto,
  CreateComplianceRuleSchema,
  UpdateComplianceRuleDto,
  UpdateComplianceRuleSchema,
  ReorderRulesDto,
  ReorderRulesSchema,
} from '@healthclaim/shared';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { Query } from '@nestjs/common';

@Controller('rules')
export class RulesController {
  constructor(private readonly ruleEngineService: RuleEngineService) {}

  /**
   * Benchmark Evaluation Endpoint for k6 Scalability & Cache Stress Testing
   * Supports ?bypassCache=true to benchmark DB saturation vs Redis cache acceleration
   */
  @Post('benchmark-evaluate')
  async benchmarkEvaluate(
    @Body() candidate: any,
    @Query('bypassCache') bypassCache?: string,
  ) {
    const shouldBypass = bypassCache === 'true' || bypassCache === '1';
    const startTime = Date.now();
    const result = await this.ruleEngineService.evaluateCandidate(candidate, shouldBypass);
    const durationMs = Date.now() - startTime;
    return {
      ...result,
      durationMs,
      cached: !shouldBypass,
      cacheMetrics: this.ruleEngineService.getCacheMetrics(),
    };
  }

  /**
   * List all compliance rules (Admin & Claim Officer)
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN, UserRole.CLAIM_OFFICER)
  async getAllRules() {
    return this.ruleEngineService.getAllRules();
  }

  /**
   * Reorder compliance rules execution order (System Admin only)
   */
  @Patch('reorder')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  async reorderRules(
    @Body(new ZodValidationPipe(ReorderRulesSchema)) dto: ReorderRulesDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ruleEngineService.reorderRules(dto.ruleIds, actor.id);
  }

  /**
   * Create a new AST compliance rule (System Admin only)
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  async createRule(
    @Body(new ZodValidationPipe(CreateComplianceRuleSchema)) dto: CreateComplianceRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ruleEngineService.createRule(dto, actor.id);
  }

  /**
   * Update an existing AST compliance rule (System Admin only)
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  async updateRule(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateComplianceRuleSchema)) dto: UpdateComplianceRuleDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ruleEngineService.updateRule(id, dto, actor.id);
  }

  /**
   * Delete a compliance rule (System Admin only)
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SYSTEM_ADMIN)
  async deleteRule(
    @Param('id') id: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.ruleEngineService.deleteRule(id, actor.id);
  }
}
