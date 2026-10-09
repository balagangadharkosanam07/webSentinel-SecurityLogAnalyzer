import { app } from './app.js';
import { env } from './config/env.js';
import { initPortalTables, pool } from './db/index.js';
import { flushLoggedEvents } from './middleware/webSentinelLogger.js';

async function bootstrap() {
  try {
    console.log('🔄 Initializing Attendance Portal Database schema...');
    await initPortalTables();
    console.log('✅ Portal tables verified');

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Student Attendance Portal API running on http://localhost:${env.PORT}`);
      console.log(`🛡️  WebSentinel Log Streaming: Active -> ${env.WEBSENTINEL_INGESTION_URL}`);
      console.log(`📋 Health Endpoint: http://localhost:${env.PORT}/api/health`);
    });

    const shutdown = async () => {
      console.log('\n🛑 Initiating graceful shutdown of Attendance Portal...');
      await flushLoggedEvents();
      server.close(async () => {
        await pool.end();
        console.log('👋 Attendance Portal stopped cleanly');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err: any) {
    console.error('❌ Failed to bootstrap Attendance Portal API:', err);
    process.exit(1);
  }
}

bootstrap();
