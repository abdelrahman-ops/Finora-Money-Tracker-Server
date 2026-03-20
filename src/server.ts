import app from './app';
import { env } from './common/config/env';
import { connectDatabase } from './common/config/database';
import { logger } from './common/utils/logger';
import { seedDefaultCategories } from './common/utils/seed';

async function bootstrap() {
  // Connect to MongoDB
  await connectDatabase();

  // Seed defaults on first run
  await seedDefaultCategories();

  // Start server
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Finora server running on port ${env.PORT} [${env.NODE_ENV}]`);
    logger.info(`📋 Health check: http://localhost:${env.PORT}/api/health`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      logger.info('Server closed');
      process.exit(0);
    });

    // Force shutdown after 10s
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Rejection:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
  });
}

bootstrap().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
