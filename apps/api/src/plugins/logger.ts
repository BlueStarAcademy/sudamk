/**
 * Logger configuration
 */

import type { FastifyInstance } from 'fastify';

export function configureLogger() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  return {
    level: isDevelopment ? 'debug' : 'info',
    transport: isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  };
}

