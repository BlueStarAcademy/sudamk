/**
 * CORS plugin configuration
 */

import cors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export async function registerCors(fastify: FastifyInstance) {
  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow all origins in development
      if (process.env.NODE_ENV === 'development') {
        cb(null, true);
        return;
      }
      
      // In production, check allowed origins
      const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [];
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        cb(new Error('Not allowed'), false);
      }
    },
    credentials: true,
  });
}

