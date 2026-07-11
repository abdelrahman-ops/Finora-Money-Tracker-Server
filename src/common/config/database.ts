import mongoose from 'mongoose';
import { env } from './env';
import { logger } from '../utils/logger';
import dns from 'dns';

// Only set custom DNS servers in local development when not running on Vercel
if (!process.env.VERCEL && env.NODE_ENV !== 'production') {
  try {
    dns.setServers(['8.8.8.8', '1.1.1.1']);
  } catch (err) {
    logger.warn('Failed to set custom DNS servers:', err);
  }
}

export async function connectDatabase(): Promise<void> {
  if (mongoose.connection.readyState >= 1) {
    return;
  }
  try {
    await mongoose.connect(env.MONGODB_URI, {
      serverSelectionTimeoutMS: 10000, // Wait 10s for server selection
      socketTimeoutMS: 45000,
      // Force IPv4 (helps with some network configurations)
      family: 4,
    });
    logger.info('✅ MongoDB connected successfully');
  } catch (error) {
    logger.error('❌ MongoDB connection failed:', error);
    throw error;
  }

  mongoose.connection.on('error', (err) => {
    logger.error('MongoDB connection error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected gracefully');
}
