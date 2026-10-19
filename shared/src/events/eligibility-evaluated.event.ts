import { z } from 'zod';

export const EvaluatedRuleItemSchema = z.object({
  ruleId: z.string(),
  ruleCode: z.string(),
  ruleName: z.string(),
  isPassed: z.boolean(),
  reason: z.string().optional(),
});

export type EvaluatedRuleItem = z.infer<typeof EvaluatedRuleItemSchema>;

export const EligibilityEvaluatedEventSchema = z.object({
  eventId: z.string().uuid(),
  claimId: z.string().uuid(),
  claimNumber: z.string().min(1),
  userId: z.string().uuid(),
  passed: z.boolean(),
  ruleResults: z.array(EvaluatedRuleItemSchema),
  matchedRuleIds: z.array(z.string()),
  rejectionReasons: z.array(z.string()),
  evaluatedAt: z.string(),
  evaluationDurationMs: z.number().nonnegative(),
});

export type EligibilityEvaluatedEvent = z.infer<typeof EligibilityEvaluatedEventSchema>;
