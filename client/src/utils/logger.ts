/**
 * Условный логгер, который выводит сообщения только при DEBUG_MODE=true
 */

export const logger = {
  debug(...args: any[]) {
    if (import.meta.env.DEV || import.meta.env.VITE_DEBUG_MODE === 'true') {
      console.log('[DEBUG]', ...args);
    }
  },
  
  info(...args: any[]) {
    console.log('[INFO]', ...args);
  },
  
  warn(...args: any[]) {
    console.warn('[WARN]', ...args);
  },
  
  error(...args: any[]) {
    console.error('[ERROR]', ...args);
  }
};