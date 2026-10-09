import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from './schema/index.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

// Parse connection URL to configure pool
export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('sslmode=require') || env.DATABASE_URL.includes('neon.tech')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client pool', { error: err.message });
});

export const db = drizzle(pool, { schema });

/**
 * Verifies active database connectivity against PostgreSQL / Neon DB
 */
export async function checkDatabaseConnection(): Promise<{ connected: boolean; version?: string; error?: string }> {
  try {
    const client = await pool.connect();
    try {
      const res = await client.query('SELECT version(), current_database() as db_name;');
      const version = res.rows[0]?.version as string;
      const dbName = res.rows[0]?.db_name as string;
      logger.info(`✅ Connected to PostgreSQL database [${dbName}]: ${version.split(' ')[0]} ${version.split(' ')[1]}`);
      return { connected: true, version };
    } finally {
      client.release();
    }
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error('❌ Failed to connect to PostgreSQL database', { error: errorMsg });
    return { connected: false, error: errorMsg };
  }
}
