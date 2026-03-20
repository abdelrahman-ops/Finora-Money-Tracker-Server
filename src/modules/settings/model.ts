import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ISetting extends Document {
  userId: Types.ObjectId;
  key: string;
  value: any;
}

const settingSchema = new Schema<ISetting>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    key: { type: String, required: true },
    value: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

settingSchema.index({ userId: 1, key: 1 }, { unique: true });

export const Setting = mongoose.model<ISetting>('Setting', settingSchema);
