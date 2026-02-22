import { z } from 'zod';

const isoDateSchema = z.string().min(1).refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  'Date must be a valid date string'
);

const canonicalTransferSchema = z.object({
  userId: z.string().min(1, 'userId is required'),
  householdId: z.string().min(1, 'householdId is required'),
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amountCents: z.number().int('Amount must be an integer number of cents').positive('Amount must be greater than 0'),
  feesCents: z.number().int('Fees must be an integer number of cents').min(0, 'Fees must be 0 or greater').default(0),
  date: isoDateSchema,
  description: z.string().min(1, 'Description is required'),
  notes: z.string().nullable().optional(),
  isPending: z.boolean().optional(),
  isBalanceTransfer: z.boolean().optional(),
  savingsGoalId: z.string().nullable().optional(),
  offlineId: z.string().nullable().optional(),
  syncStatus: z.enum(['pending', 'syncing', 'synced', 'error', 'offline']).optional(),
  transferGroupId: z.string().optional(),
  fromTransactionId: z.string().optional(),
  toTransactionId: z.string().optional(),
});

export type CanonicalTransferInput = z.infer<typeof canonicalTransferSchema>;

export function validateCanonicalTransferInput(input: unknown): CanonicalTransferInput {
  const parsed = canonicalTransferSchema.safeParse(input);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || 'Invalid transfer payload';
    throw new Error(message);
  }

  const normalized = parsed.data;
  if (normalized.fromAccountId === normalized.toAccountId) {
    throw new Error('Cannot transfer to the same account');
  }

  return normalized;
}

