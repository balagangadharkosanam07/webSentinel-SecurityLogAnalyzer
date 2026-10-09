import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { env } from '../config/env.js';
import * as schema from './schema.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DATABASE_URL.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined,
  max: 10,
  idleTimeoutMillis: 30000,
});

export const db = drizzle(pool, { schema });

/**
 * Ensures the portal tables exist in PostgreSQL
 */
export async function initPortalTables(): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS portal_users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        email VARCHAR(256) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(32) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS portal_courses (
        id VARCHAR(36) PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL,
        teacher_id VARCHAR(36) REFERENCES portal_users(id) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS portal_attendance (
        id VARCHAR(36) PRIMARY KEY,
        student_id VARCHAR(36) REFERENCES portal_users(id) NOT NULL,
        course_id VARCHAR(36) REFERENCES portal_courses(id) NOT NULL,
        session_date VARCHAR(32) NOT NULL,
        status VARCHAR(32) NOT NULL,
        marked_by VARCHAR(36) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
      );
    `);
  } finally {
    client.release();
  }
}
