import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { logger } from '../utils/logger.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runMigrations() {
  logger.info('⏳ Running Drizzle SQL migrations against Neon PostgreSQL...');
  const migrationsFolder = path.resolve(__dirname, '../../drizzle');

  try {
    await migrate(db, { migrationsFolder });
    logger.info('✅ Drizzle SQL migrations applied successfully!');
  } catch (error) {
    logger.error('❌ Migration failed:', { error: error instanceof Error ? error.message : String(error) });
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
