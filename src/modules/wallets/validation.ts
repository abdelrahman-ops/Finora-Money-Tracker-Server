import { z } from 'zod';

export const createWalletSchema = z.object({
  name: z.string().min(1).max(50),
  type: z.enum([
    'cash', 'bank', 'credit', 'savings', 'investment',
    'e-wallet', 'crypto', 'meal card', 'loan', 'business', 'other'
  ]).optional(),
  balance: z.number().default(0),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const updateWalletSchema = createWalletSchema.partial();
