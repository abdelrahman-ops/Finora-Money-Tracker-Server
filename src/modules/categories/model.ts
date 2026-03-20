import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
  userId?: Types.ObjectId;
  name: string;
  type: 'expense' | 'income';
  color: string;
  icon: string;
  isDefault: boolean;
}

const categorySchema = new Schema<ICategory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['expense', 'income'], required: true },
    color: { type: String, default: '#64748b' },
    icon: { type: String, default: 'package' },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true },
);

categorySchema.index({ userId: 1, type: 1 });

export const Category = mongoose.model<ICategory>('Category', categorySchema);
