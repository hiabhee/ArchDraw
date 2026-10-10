const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  debug: (...args: unknown[]) => {
    if (isDevelopment) console.debug(...args);
  },
  info: (...args: unknown[]) => {
    if (isDevelopment) console.info(...args);
  },
  warn: (...args: unknown[]) => {
    console.warn(...args);
  },
  error: (...args: unknown[]) => {
    console.error(...args);
  },
  log: (...args: unknown[]) => {
    if (isDevelopment) console.log(...args);
  },
  table: (...args: unknown[]) => {
    if (isDevelopment) console.table(...args);
  },
};

export default logger;
