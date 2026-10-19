import { z } from 'zod';
import { ClaimCategory } from '../schemas/claim.schema';

export const BenefitCalculatedItemSchema = z.object({
  description: z.string(),
  category: z.nativeEnum(ClaimCategory),
  totalPrice: z.number(),
  isEligible: z.boolean(),
  coveredAmount: z.number(),
  employeeShare: z.number(),
});

export type BenefitCalculatedItem = z.infer<typeof BenefitCalculatedItemSchema>;

export const BenefitCalculatedEventSchema = z.object({
  eventId: z.string().uuid(),
  claimId: z.string().uuid(),
  claimNumber: z.string().min(1),
  userId: z.string().uuid(),
  benefitTierName: z.string(),
  requestedAmount: z.number().positive(),
  eligibleAmount: z.number().nonnegative(),
  ineligibleAmount: z.number().nonnegative(),
  deductibleApplied: z.number().nonnegative(),
  remainingDeductibleBefore: z.number().nonnegative(),
  remainingDeductibleAfter: z.number().nonnegative(),
  applicableCoPayRate: z.number().nonnegative(),
  approvedAmount: z.number().nonnegative(),
  employeeOutOfPocket: z.number().nonnegative(),
  quotaBeforeClaim: z.number().nonnegative(),
  quotaAfterClaim: z.number().nonnegative(),
  isCappedByQuota: z.boolean(),
  breakdown: z.array(BenefitCalculatedItemSchema),
  calculatedAt: z.string(),
});

export type BenefitCalculatedEvent = z.infer<typeof BenefitCalculatedEventSchema>;
