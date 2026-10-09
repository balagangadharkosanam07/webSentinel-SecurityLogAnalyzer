import { env } from '../config/env.js';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'api_key',
  'apikey',
  'access_token',
]);

function redactSensitiveData(data: unknown): unknown {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(redactSensitiveData);

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = redactSensitiveData(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function shouldLog(level: LogLevel): boolean {
  const current = LEVEL_PRIORITY[env.LOG_LEVEL as LogLevel] ?? 1;
  return LEVEL_PRIORITY[level] >= current;
}

function formatLog(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const metaStr = meta ? ` | ${JSON.stringify(redactSensitiveData(meta))}` : '';
  return `[${timestamp}] [${level.toUpperCase()}] ${message}${metaStr}`;
}

export const logger = {
  debug: (message: string, meta?: unknown) => {
    if (shouldLog('debug')) console.debug(formatLog('debug', message, meta));
  },
  info: (message: string, meta?: unknown) => {
    if (shouldLog('info')) console.info(formatLog('info', message, meta));
  },
  warn: (message: string, meta?: unknown) => {
    if (shouldLog('warn')) console.warn(formatLog('warn', message, meta));
  },
  error: (message: string, meta?: unknown) => {
    if (shouldLog('error')) console.error(formatLog('error', message, meta));
  },
};
