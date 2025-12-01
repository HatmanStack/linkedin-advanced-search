type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
}

const SENSITIVE_PATTERNS = [
  'password',
  'token',
  'secret',
  'apiKey',
  'accessToken',
  'refreshToken',
  'sessionId',
  'ssn',
  'creditCard',
  'cvv'
];

const isDevelopment = (): boolean => {
  return import.meta.env.DEV || import.meta.env.MODE === 'development';
};

const maskSensitiveData = (data: unknown): unknown => {
  if (!data || typeof data !== 'object') {
    return data;
  }

  if (Array.isArray(data)) {
    return data.map(item => maskSensitiveData(item));
  }

  const masked: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    const isSensitive = SENSITIVE_PATTERNS.some(pattern =>
      lowerKey.includes(pattern.toLowerCase())
    );

    if (isSensitive) {
      masked[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
};

const formatLogEntry = (entry: LogEntry): string => {
  const { timestamp, level, message, context } = entry;
  const levelStr = level.toUpperCase().padEnd(5);

  let output = `[${timestamp}] ${levelStr} ${message}`;

  if (context && Object.keys(context).length > 0) {
    const maskedContext = maskSensitiveData(context);
    output += ` ${JSON.stringify(maskedContext)}`;
  }

  return output;
};

const log = (level: LogLevel, message: string, context?: LogContext): void => {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context: context ? maskSensitiveData(context) as LogContext : undefined
  };

  if (!isDevelopment() && (level === 'debug' || level === 'info')) {
    return;
  }

  const formatted = formatLogEntry(entry);

  switch (level) {
    case 'debug':
      if (isDevelopment()) {
        console.debug(formatted);
      }
      break;
    case 'info':
      if (isDevelopment()) {
        console.info(formatted);
      }
      break;
    case 'warn':
      console.warn(formatted);
      break;
    case 'error':
      console.error(formatted);
      break;
  }
};

export const logger = {
  debug: (message: string, context?: LogContext): void => {
    log('debug', message, context);
  },

  info: (message: string, context?: LogContext): void => {
    log('info', message, context);
  },

  warn: (message: string, context?: LogContext): void => {
    log('warn', message, context);
  },

  error: (message: string, context?: LogContext): void => {
    log('error', message, context);
  },

  log: (level: LogLevel, message: string, context?: LogContext): void => {
    log(level, message, context);
  }
};

export const createLogger = (module: string) => ({
  debug: (message: string, context?: LogContext) =>
    logger.debug(`[${module}] ${message}`, context),
  info: (message: string, context?: LogContext) =>
    logger.info(`[${module}] ${message}`, context),
  warn: (message: string, context?: LogContext) =>
    logger.warn(`[${module}] ${message}`, context),
  error: (message: string, context?: LogContext) =>
    logger.error(`[${module}] ${message}`, context),
});

export default logger;
