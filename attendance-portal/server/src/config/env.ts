import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load package-specific .env first, then root .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });
dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16).default('dev-jwt-super-secret-key-for-attendance-portal-2026'),
  WEBSENTINEL_INGESTION_URL: z.string().url().default('http://localhost:4000/api/logs/import'),
  WEBSENTINEL_API_KEY: z.string().min(1).default('dev-sample-ingestion-key-change-in-prod'),
});

const parseEnv = () => {
  const rawPort = process.env.PORTAL_PORT || (process.env.PORT && process.env.PORT !== '4000' ? process.env.PORT : 5000);
  const result = envSchema.safeParse({
    ...process.env,
    PORT: rawPort,
  });
  if (!result.success) {
    console.error('❌ Invalid Attendance Portal environment variables:');
    result.error.issues.forEach((issue) => {
      console.error(`   - ${issue.path.join('.')}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
};

export const env = parseEnv();
export type Environment = z.infer<typeof envSchema>;
