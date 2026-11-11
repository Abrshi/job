const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLevel = (process.env.LOG_LEVEL || 'info').toLowerCase();
const minLevel = LOG_LEVELS[currentLevel] !== undefined ? LOG_LEVELS[currentLevel] : LOG_LEVELS.info;

function sanitize(data) {
  if (!data) return data;
  if (typeof data === 'string') {
    // Redact session strings, api hash, bot tokens, secrets
    return data
      .replace(/1[a-zA-Z0-9_-]{50,}/g, '[REDACTED_SESSION]')
      .replace(/([?&]api_hash=)[^&]+/gi, '$1[REDACTED]')
      .replace(/(secret=)[^&]+/gi, '$1[REDACTED]');
  }
  if (typeof data === 'object') {
    const copy = Array.isArray(data) ? [...data] : { ...data };
    for (const key of Object.keys(copy)) {
      if (/session|api[_-]?hash|secret|token|password|auth/i.test(key)) {
        copy[key] = '[REDACTED]';
      } else if (typeof copy[key] === 'object' && copy[key] !== null) {
        copy[key] = sanitize(copy[key]);
      }
    }
    return copy;
  }
  return data;
}

function formatMessage(level, message, meta) {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}] [TelegramWorker]:`;
  const sanitizedMsg = typeof message === 'string' ? sanitize(message) : message;

  if (meta !== undefined) {
    return `${prefix} ${sanitizedMsg} ${JSON.stringify(sanitize(meta))}`;
  }
  return `${prefix} ${sanitizedMsg}`;
}

export const logger = {
  debug(message, meta) {
    if (minLevel <= LOG_LEVELS.debug) {
      console.debug(formatMessage('debug', message, meta));
    }
  },
  info(message, meta) {
    if (minLevel <= LOG_LEVELS.info) {
      console.log(formatMessage('info', message, meta));
    }
  },
  warn(message, meta) {
    if (minLevel <= LOG_LEVELS.warn) {
      console.warn(formatMessage('warn', message, meta));
    }
  },
  error(message, meta) {
    if (minLevel <= LOG_LEVELS.error) {
      console.error(formatMessage('error', message, meta));
    }
  },
};
