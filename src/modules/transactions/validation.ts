import { z } from 'zod';

export const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense', 'transfer', 'adjustment']),
  name: z.string().default(''),
  note: z.string().optional(),
  accountId: z.string().min(1, 'Account is required'),
  toAccountId: z.string().nullish().transform(v => (v === 'none' || v === '' || v === null) ? undefined : v),
  categoryId: z.string().nullish().transform(v => (v === 'none' || v === '' || v === null) ? undefined : v),
  debtId: z.string().nullish().transform(v => (v === 'none' || v === '' || v === null) ? undefined : v),
  savingsGoalId: z.string().nullish().transform(v => (v === 'none' || v === '' || v === null) ? undefined : v),
  date: z.string().min(1, 'Date is required'),
});

export const updateTransactionSchema = createTransactionSchema;

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
