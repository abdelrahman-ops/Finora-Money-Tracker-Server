import mongoose, { Schema, Document, Types } from 'mongoose';

export interface INotification extends Document {
  userId: Types.ObjectId;
  title: string;
  message: string;
  isRead: boolean;
  type: string;
  priority: 'low' | 'medium' | 'high';
  category: string;
  icon: string;
  color: string;
  uniqueKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  isRead: { type: Boolean, default: false },
  type: { type: String, default: 'info' },
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'low' },
  category: { type: String, default: 'general' },
  icon: { type: String, default: 'bell' },
  color: { type: String, default: '#3b82f6' },
  uniqueKey: { type: String, index: true }
}, { timestamps: true });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
