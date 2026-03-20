import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ITemplate extends Document {
  userId: Types.ObjectId;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  categoryId?: Types.ObjectId;
  defaultAccountId?: Types.ObjectId;
  isRecurring: boolean;
  recurringDate?: number;
}

const templateSchema = new Schema<ITemplate>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category' },
    defaultAccountId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
    isRecurring: { type: Boolean, default: false },
    recurringDate: { type: Number, min: 1, max: 31 },
  },
  { timestamps: true },
);

export const Template = mongoose.model<ITemplate>('Template', templateSchema);
