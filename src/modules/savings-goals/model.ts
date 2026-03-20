import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISavingsGoal extends Document {
  userId: Types.ObjectId;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: Date;
  color: string;
  icon: string;
  walletId?: Types.ObjectId;
  status: 'active' | 'completed' | 'cancelled';
  createdAt: Date;
}

const savingsGoalSchema = new Schema<ISavingsGoal>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: 0 },
    currentAmount: { type: Number, default: 0, min: 0 },
    deadline: { type: Date },
    color: { type: String, default: '#22c55e' },
    icon: { type: String, default: 'piggy-bank' },
    walletId: { type: Schema.Types.ObjectId, ref: 'Wallet' },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  },
  { timestamps: true },
);

export const SavingsGoal = mongoose.model<ISavingsGoal>('SavingsGoal', savingsGoalSchema);
