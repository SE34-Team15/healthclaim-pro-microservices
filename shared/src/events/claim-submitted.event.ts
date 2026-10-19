import { z } from 'zod';
import { ClaimCategory, ClaimItemSchema } from '../schemas/claim.schema';

export const ClaimSubmittedEventSchema = z.object({
  eventId: z.string().uuid(),
  claimId: z.string().uuid(),
  claimNumber: z.string().min(1),
  userId: z.string().uuid(),
  category: z.nativeEnum(ClaimCategory),
  hospitalName: z.string().min(1),
  hospitalGrade: z.string().default('GRADE_A'),
  invoiceDate: z.string(),
  totalAmount: z.number().positive(),
  items: z.array(ClaimItemSchema).min(1),
  attachmentIds: z.array(z.string().uuid()).default([]),
  submittedAt: z.string(),
});

export type ClaimSubmittedEvent = z.infer<typeof ClaimSubmittedEventSchema>;
