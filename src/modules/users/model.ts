import mongoose, { Schema, Document } from 'mongoose';

export interface IRefreshSession {
  sessionId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  lastRotatedAt: Date;
  userAgent?: string;
  ipAddress?: string;
}

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  currency: string;
  tokenVersion: number;
  refreshSessions: IRefreshSession[];
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const refreshSessionSchema = new Schema<IRefreshSession>(
  {
    sessionId: {
      type: String,
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      select: false,
    },
    createdAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    lastRotatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    userAgent: {
      type: String,
      default: '',
    },
    ipAddress: {
      type: String,
      default: '',
    },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    currency: {
      type: String,
      default: 'EGP',
    },
    tokenVersion: {
      type: Number,
      default: 0,
    },
    refreshSessions: {
      type: [refreshSessionSchema],
      default: [],
      select: false,
    },
    passwordResetTokenHash: {
      type: String,
      select: false,
    },
    passwordResetExpiresAt: {
      type: Date,
      select: false,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret: Record<string, any>) {
        delete ret.password;
        delete ret.refreshSessions;
        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;
        delete ret.__v;
        return ret;
      },
    },
  },
);

export const User = mongoose.model<IUser>('User', userSchema);
