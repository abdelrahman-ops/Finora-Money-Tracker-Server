import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAlert extends Document {
  userId: Types.ObjectId;
  type: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  date: Date;
  isRead: boolean;
  relatedId?: string;
}

const alertSchema = new Schema<IAlert>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true },
    message: { type: String, required: true },
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    date: { type: Date, default: Date.now, index: true },
    isRead: { type: Boolean, default: false },
    relatedId: { type: String },
  },
  { timestamps: true },
);

alertSchema.index({ userId: 1, date: -1 });

export const Alert = mongoose.model<IAlert>('Alert', alertSchema);
