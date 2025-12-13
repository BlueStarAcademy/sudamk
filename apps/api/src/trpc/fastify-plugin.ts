/**
 * Fastify plugin for tRPC
 */

import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { FastifyInstance } from 'fastify';
import { TRPCError } from '@trpc/server';
import { appRouter } from './router.js';
import { createContext } from './context.js';
import { getEnv } from '../utils/env.js';

const env = getEnv();
const isDevelopment = env.NODE_ENV === 'development';

export async function registerTRPC(fastify: FastifyInstance) {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
      createContext,
      onError: ({ path, error, type, ctx, input }) => {
        // Log error with context
        fastify.log.error({
          err: error,
          path,
          type,
          code: error.code,
          message: error.message,
          input: isDevelopment ? input : undefined,
          userId: ctx?.user?.id,
        });

        // In development, log stack trace
        if (isDevelopment && error.cause) {
          fastify.log.error({
            cause: error.cause,
            stack: error.cause instanceof Error ? error.cause.stack : undefined,
          });
        }
      },
    },
  });
  
  fastify.log.info('[tRPC] tRPC plugin registered at /trpc');
}

