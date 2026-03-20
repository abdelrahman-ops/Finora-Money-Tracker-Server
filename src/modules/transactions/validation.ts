import { z } from 'zod';

export const createTransactionSchema = z.object({
  amount: z.number().positive('Amount must be positive'),
  type: z.enum(['income', 'expense', 'transfer', 'adjustment']),
  name: z.string().default(''),
  note: z.string().optional(),
  accountId: z.string().min(1, 'Account is required'),
  toAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  debtId: z.string().optional(),
  savingsGoalId: z.string().optional(),
  date: z.string().min(1, 'Date is required'),
});

export const updateTransactionSchema = createTransactionSchema;

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
