import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import mongoose from 'mongoose';
import { env } from './env';
import { sendPasswordResetEmail, sendVerificationEmail } from '../utils/mailer';
import { logger } from '../utils/logger';

// Create a lazy DB proxy for Better Auth so it doesn't try to access Mongoose before connection is active.
const lazyDb = {
  collection(name: string) {
    if (!mongoose.connection.db) {
      throw new Error('Database is not connected yet. Cannot access collection: ' + name);
    }
    return mongoose.connection.db.collection(name);
  }
} as unknown as any;

export const auth = betterAuth({
  database: mongodbAdapter(lazyDb, {
    usePlural: true,
  }),
  secret: env.JWT_SECRET, // reuse JWT_SECRET for better-auth secret
  baseURL: env.BETTER_AUTH_URL + '/api/auth',   // Full backend auth route
  trustedOrigins: [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:3000',
    'http://localhost:3001',
    'https://finora-flax.vercel.app',
  ],
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      logger.info(`🔑 [Development] Password reset link for ${user.email}: ${url}`);
      try {
        await sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          resetUrl: url,
        });
        logger.info(`Password reset email sent to ${user.email}`);
      } catch (err) {
        logger.error(`Failed to send password reset email to ${user.email}:`, err);
      }
    },
  },
  user: {
    additionalFields: {
      currency: {
        type: 'string',
        required: false,
        defaultValue: 'EGP',
      },
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    sendVerificationEmail: async ({ user, url }) => {
      logger.info(`🔑 [Development] Email verification link for ${user.email}: ${url}`);
      try {
        await sendVerificationEmail({
          to: user.email,
          name: user.name,
          verificationUrl: url,
        });
        logger.info(`Verification email sent to ${user.email}`);
      } catch (err) {
        logger.error(`Failed to send verification email to ${user.email}:`, err);
      }
    },
  },
});
export type Auth = typeof auth;

