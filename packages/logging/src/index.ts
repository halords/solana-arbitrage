import pino, { Logger, LoggerOptions } from 'pino';

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'jwt',
  'token',
  'authorization',
  'key',
  'privatekey',
  'private_key',
  'seed',
  'signature',
];

export function createLogger(serviceName: string, level = 'info'): Logger {
  const options: LoggerOptions = {
    name: serviceName,
    level,
    redact: {
      paths: SENSITIVE_KEYS.flatMap((k) => [k, `*.${k}`, `*.*.${k}`]),
      censor: '[REDACTED]',
    },
    formatters: {
      level: (label: string): { level: string } => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  return pino(options);
}
