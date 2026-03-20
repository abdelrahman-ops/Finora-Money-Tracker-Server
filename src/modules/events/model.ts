import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IEvent extends Document {
  userId: Types.ObjectId;
  type: string;
  entityType: string;
  entityId?: string;
  payload: Record<string, any>;
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, required: true, index: true },
    entityType: { type: String, required: true },
    entityId: { type: String },
    payload: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

eventSchema.index({ userId: 1, createdAt: -1 });
eventSchema.index({ userId: 1, entityType: 1, entityId: 1 });
// TTL index: auto-delete events older than 90 days
eventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Event = mongoose.model<IEvent>('Event', eventSchema);
