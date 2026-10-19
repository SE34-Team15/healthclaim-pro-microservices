import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RuleEngineService } from '../src/rules/rules.service';
import { LogicalOperator, ComparisonOperator } from '@healthclaim/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      complianceRule: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        count: vi.fn(),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      $transaction: vi.fn((promises) => Promise.all(promises)),
    };

    service = new RuleEngineService(prismaMock);
  });

  describe('evaluateCandidate', () => {
    it('should evaluate candidate against active rules and return allPassed = true when all rules match', async () => {
      prismaMock.complianceRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          code: 'RULE_MIN_AMOUNT',
          name: 'Minimum Claim Amount',
          astDefinition: {
            type: 'COMPARISON',
            field: 'totalAmount',
            operator: ComparisonOperator.GREATER_THAN,
            value: 0,
          },
          isActive: true,
          priority: 10,
        },
      ]);

      const candidate = {
        category: 'CONSULTATION',
        totalAmount: 100,
        hospitalName: 'General Hospital',
        items: [],
      };

      const result = await service.evaluateCandidate(candidate);
      expect(result.allPassed).toBe(true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0].isPassed).toBe(true);
    });

    it('should read from Redis cache without querying Prisma when cache hits', async () => {
      const mockRedis: any = {
        get: vi.fn().mockResolvedValue([
          {
            id: 'cached-rule-1',
            code: 'CACHED_RULE',
            name: 'Cached Rule',
            astDefinition: {
              type: 'COMPARISON',
              field: 'totalAmount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
            },
            isActive: true,
            priority: 1,
          },
        ]),
        set: vi.fn(),
        del: vi.fn(),
        getMetrics: vi.fn().mockReturnValue({ hitRatio: 100 }),
      };

      const cachedService = new RuleEngineService(prismaMock, mockRedis);
      const result = await cachedService.evaluateCandidate({
        category: 'CONSULTATION',
        totalAmount: 50,
        hospitalName: 'Hospital',
        items: [],
      });

      expect(result.allPassed).toBe(true);
      expect(mockRedis.get).toHaveBeenCalledWith('healthclaim:rules:active');
      expect(prismaMock.complianceRule.findMany).not.toHaveBeenCalled();
    });

    it('should return allPassed = false if any rule evaluation fails', async () => {
      prismaMock.complianceRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          code: 'RULE_ACCREDITED_HOSPITAL',
          name: 'Accredited Hospital',
          astDefinition: {
            type: 'COMPARISON',
            field: 'hospitalGrade',
            operator: ComparisonOperator.EQUALS,
            value: 'GRADE_3A',
          },
          isActive: true,
          priority: 10,
        },
      ]);

      const candidate = {
        category: 'CONSULTATION',
        totalAmount: 100,
        hospitalName: 'Clinic XYZ',
        hospitalGrade: 'UNACCREDITED',
        items: [],
      };

      const result = await service.evaluateCandidate(candidate);
      expect(result.allPassed).toBe(false);
      expect(result.results[0].isPassed).toBe(false);
    });

    it('should catch evaluation errors gracefully and mark rule as failed', async () => {
      prismaMock.complianceRule.findMany.mockResolvedValue([
        {
          id: 'rule-err',
          code: 'RULE_CORRUPT_AST',
          name: 'Corrupt Rule',
          astDefinition: {
            type: 'INVALID_TYPE' as any,
          },
          isActive: true,
          priority: 10,
        },
      ]);

      const candidate = {
        category: 'CONSULTATION',
        totalAmount: 100,
        hospitalName: 'Clinic XYZ',
        items: [],
      };

      const result = await service.evaluateCandidate(candidate);
      expect(result.allPassed).toBe(false);
      expect(result.results[0].reason).toContain('Engine Evaluation Error');
    });
  });

  describe('getAllRules', () => {
    it('should retrieve all compliance rules ordered by priority', async () => {
      const mockRules = [
        { id: '1', code: 'RULE_1', priority: 10 },
        { id: '2', code: 'RULE_2', priority: 20 },
      ];
      prismaMock.complianceRule.findMany.mockResolvedValue(mockRules);

      const rules = await service.getAllRules();
      expect(rules).toEqual(mockRules);
      expect(prismaMock.complianceRule.findMany).toHaveBeenCalledWith({
        orderBy: { priority: 'asc' },
      });
    });
  });

  describe('createRule', () => {
    it('should throw ConflictException if rule code already exists', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue({ id: 'existing-id' });

      await expect(
        service.createRule(
          {
            code: 'RULE_EXISTING',
            name: 'Existing Rule',
            astDefinition: {
              type: 'COMPARISON',
              field: 'totalAmount',
              operator: ComparisonOperator.GREATER_THAN,
              value: 0,
            },
          },
          'admin-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should create rule and record audit log successfully', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue(null);
      prismaMock.complianceRule.count.mockResolvedValue(2);
      prismaMock.complianceRule.create.mockImplementation(({ data }: any) => ({
        id: 'new-rule-id',
        ...data,
      }));

      const created = await service.createRule(
        {
          code: 'RULE_NEW',
          name: 'New Rule',
          description: 'A test rule',
          astDefinition: {
            type: 'COMPARISON',
            field: 'totalAmount',
            operator: ComparisonOperator.GREATER_THAN,
            value: 50,
          },
        },
        'admin-1',
      );

      expect(created.code).toBe('RULE_NEW');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'CREATE_COMPLIANCE_RULE',
            actorId: 'admin-1',
          }),
        }),
      );
    });
  });

  describe('updateRule', () => {
    it('should throw NotFoundException if rule does not exist', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue(null);

      await expect(
        service.updateRule('non-existent-id', { name: 'Updated' }, 'admin-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should update rule and record audit log', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        code: 'RULE_1',
        name: 'Old Name',
      });
      prismaMock.complianceRule.update.mockResolvedValue({
        id: 'rule-1',
        code: 'RULE_1',
        name: 'Updated Name',
      });

      const result = await service.updateRule(
        'rule-1',
        {
          name: 'Updated Name',
          astDefinition: {
            type: 'COMPARISON',
            field: 'totalAmount',
            operator: ComparisonOperator.GREATER_THAN,
            value: 100,
          },
        },
        'admin-1',
      );

      expect(result.name).toBe('Updated Name');
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'UPDATE_COMPLIANCE_RULE',
          }),
        }),
      );
    });
  });

  describe('reorderRules', () => {
    it('should update priorities in batch and log audit event', async () => {
      prismaMock.complianceRule.findMany.mockResolvedValue([]);
      prismaMock.complianceRule.update.mockResolvedValue({});

      await service.reorderRules(['rule-1', 'rule-2'], 'admin-1');

      expect(prismaMock.$transaction).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'REORDER_COMPLIANCE_RULES',
          }),
        }),
      );
    });
  });

  describe('deleteRule', () => {
    it('should throw NotFoundException if rule to delete is missing', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue(null);

      await expect(service.deleteRule('missing-id', 'admin-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should delete rule and create audit log', async () => {
      prismaMock.complianceRule.findUnique.mockResolvedValue({
        id: 'rule-1',
        code: 'RULE_1',
        name: 'Rule To Delete',
      });
      prismaMock.complianceRule.delete.mockResolvedValue({});

      const result = await service.deleteRule('rule-1', 'admin-1');
      expect(result.message).toContain('deleted successfully');
      expect(prismaMock.complianceRule.delete).toHaveBeenCalledWith({
        where: { id: 'rule-1' },
      });
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'DELETE_COMPLIANCE_RULE',
          }),
        }),
      );
    });
  });
});
