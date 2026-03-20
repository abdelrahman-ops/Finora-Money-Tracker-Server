import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITransaction extends Document {
  userId: Types.ObjectId;
  amount: number;
  type: 'income' | 'expense' | 'transfer' | 'adjustment';
  name: string;
  note?: string;
  accountId: Types.ObjectId;
  toAccountId?: Types.ObjectId;
  categoryId?: Types.ObjectId;
  debtId?: Types.ObjectId;
  savingsGoalId?: Types.ObjectId;
  date: Date;
  createdAt: Date;
}

const transactionSchema = new Schema<ITransaction>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    type: {
      type: String,
      enum: ['income', 'expense', 'transfer', 'adjustment'],
      required: true,
    },
    name: { type: String, default: '', trim: true },
    note: { type: String, trim: true },
    accountId: { type: Schema.Types.ObjectId, ref: 'Wallet', required: true },
    toAccountId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    debtId: { type: Schema.Types.ObjectId, ref: 'Debt' },
    savingsGoalId: { type: Schema.Types.ObjectId, ref: 'SavingsGoal' },
    date: { type: Date, required: true, index: true },
  },
  { timestamps: true },
);

// Optimized compound indexes for common query patterns
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, accountId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, categoryId: 1, date: -1 });
transactionSchema.index({ userId: 1, toAccountId: 1 });

export const Transaction = mongoose.model<ITransaction>('Transaction', transactionSchema);
