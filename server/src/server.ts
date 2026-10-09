import { app } from './app.js';
import { env } from './config/env.js';
import { logger } from './utils/logger.js';

const server = app.listen(env.PORT, () => {
  logger.info(`=======================================================`);
  logger.info(`🛡️  WebSentinel Backend API Server Online`);
  logger.info(`    Environment: [${env.NODE_ENV.toUpperCase()}]`);
  logger.info(`    Listening on: http://localhost:${env.PORT}`);
  logger.info(`    Health endpoint: http://localhost:${env.PORT}/api/health`);
  logger.info(`    Allowed CORS Origin: ${env.CLIENT_URL}`);
  logger.info(`=======================================================`);
});

// Graceful Shutdown
function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Gracefully shutting down WebSentinel API server...`);
  server.close(() => {
    logger.info('HTTP server closed. Process terminating cleanly.');
    process.exit(0);
  });

  // Force close after 10s timeout
  setTimeout(() => {
    logger.error('Forced shutdown timeout elapsed. Terminating process immediately.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
