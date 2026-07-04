import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBudget extends Document {
  userId: Types.ObjectId;
  name?: string;
  type: 'category' | 'total';
  categoryId?: Types.ObjectId | null;
  monthKey: string;
  limit: number;
  rollover: boolean;
  alertThreshold: number;
  isRecurring: boolean;
}

const budgetSchema = new Schema<IBudget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String },
    type: { type: String, enum: ['category', 'total'], default: 'category', required: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null },
    monthKey: { type: String, required: true },
    limit: { type: Number, required: true, min: 0 },
    rollover: { type: Boolean, default: false, required: true },
    alertThreshold: { type: Number, default: 80, required: true, min: 0, max: 100 },
    isRecurring: { type: Boolean, default: true, required: true },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, monthKey: 1, type: 1, categoryId: 1 }, { unique: true });

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);
