import { app } from './app.js';
import { env } from './config/env.js';
import { initPortalTables, pool } from './db/index.js';
import { flushLoggedEvents } from './middleware/webSentinelLogger.js';

// Immediately bind to port so cloud platforms (Render) detect the service as live
const server = app.listen(env.PORT, () => {
  console.log(`🚀 Student Attendance Portal API running on port ${env.PORT}`);
  console.log(`🛡️  WebSentinel Log Streaming: Active -> ${env.WEBSENTINEL_INGESTION_URL}`);
  console.log(`📋 Health Endpoint: http://localhost:${env.PORT}/api/health`);
});

// Verify / initialize database tables asynchronously in background
initPortalTables()
  .then(() => console.log('✅ Portal tables verified'))
  .catch((err) => console.error('❌ Failed to initialize portal tables:', err.message));

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
