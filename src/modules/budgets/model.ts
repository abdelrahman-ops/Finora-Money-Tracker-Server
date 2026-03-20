import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IBudget extends Document {
  userId: Types.ObjectId;
  categoryId: Types.ObjectId;
  monthKey: string;
  limit: number;
}

const budgetSchema = new Schema<IBudget>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true },
    monthKey: { type: String, required: true },
    limit: { type: Number, required: true, min: 0 },
  },
  { timestamps: true },
);

budgetSchema.index({ userId: 1, monthKey: 1, categoryId: 1 }, { unique: true });

export const Budget = mongoose.model<IBudget>('Budget', budgetSchema);
