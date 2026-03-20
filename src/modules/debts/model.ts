import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IDebt extends Document {
  userId: Types.ObjectId;
  name: string;
  type: 'owed_to_me' | 'i_owe';
  personName: string;
  totalAmount: number;
  paidAmount: number;
  dueDate?: Date;
  status: 'active' | 'settled';
  createdAt: Date;
}

const debtSchema = new Schema<IDebt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: { type: String, enum: ['owed_to_me', 'i_owe'], required: true },
    personName: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    paidAmount: { type: Number, default: 0, min: 0 },
    dueDate: { type: Date },
    status: { type: String, enum: ['active', 'settled'], default: 'active' },
  },
  { timestamps: true },
);

export const Debt = mongoose.model<IDebt>('Debt', debtSchema);
