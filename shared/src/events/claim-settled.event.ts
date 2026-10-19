import { z } from 'zod';

export const ClaimSettledEventSchema = z.object({
  eventId: z.string().uuid(),
  claimId: z.string().uuid(),
  claimNumber: z.string().min(1),
  userId: z.string().uuid(),
  claimantName: z.string(),
  claimantEmail: z.string().email(),
  approvedAmount: z.number().nonnegative(),
  settlementReference: z.string().min(1),
  payoutMethod: z.string().default('DIRECT_BANK_TRANSFER_MOCK'),
  settledAt: z.string(),
});

export type ClaimSettledEvent = z.infer<typeof ClaimSettledEventSchema>;
