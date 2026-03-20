import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IWallet extends Document {
  userId: Types.ObjectId;
  name: string;
  type: 'cash' | 'bank' | 'credit' | 'savings' | 'investment' | 'e-wallet' | 'crypto' | 'meal card' | 'loan' | 'business' | 'other';
  balance: number;
  color: string;
  icon: string;
  createdAt: Date;
  updatedAt: Date;
}

const WALLET_TYPES = ['cash', 'bank', 'credit', 'savings', 'investment', 'e-wallet', 'crypto', 'meal card', 'loan', 'business', 'other'] as const;

const walletSchema = new Schema<IWallet>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: WALLET_TYPES,
      default: 'cash',
    },
    balance: { type: Number, default: 0 },
    color: { type: String, default: '#007AFF' },
    icon: { type: String, default: 'wallet' },
  },
  { timestamps: true },
);

walletSchema.index({ userId: 1, name: 1 });

export const Wallet = mongoose.model<IWallet>('Wallet', walletSchema);
