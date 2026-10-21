type LogLevel = 'info' | 'warn' | 'error' | 'debug';

const SENSITIVE_PATTERN = /password|passwordhash|token|refreshtoken|accesstoken|authorization|cookie|secret/i;

export function sanitize(value: unknown, seen = new WeakSet()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;

  if (seen.has(value as object)) {
    return '[Circular]';
  }
  seen.add(value as object);

  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitize(item, seen));
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(value)) {
    if (SENSITIVE_PATTERN.test(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitize(val, seen);
    } else {
      sanitized[key] = val;
    }
  }

  return sanitized;
}

function formatMessage(level: LogLevel, message: string, meta?: unknown): string {
  const timestamp = new Date().toISOString();
  const cleanMeta = meta !== undefined ? sanitize(meta) : undefined;
  const metaString = cleanMeta !== undefined ? ` ${JSON.stringify(cleanMeta)}` : '';
  return `[${timestamp}] [${level.toUpperCase()}]: ${message}${metaString}`;
}

export const logger = {
  info: (message: string, meta?: unknown) => console.log(formatMessage('info', message, meta)),
  warn: (message: string, meta?: unknown) => console.warn(formatMessage('warn', message, meta)),
  error: (message: string, meta?: unknown) => console.error(formatMessage('error', message, meta)),
  debug: (message: string, meta?: unknown) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(formatMessage('debug', message, meta));
    }
  },
};
