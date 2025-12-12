/**
 * Fastify plugin for tRPC
 */

import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import type { FastifyInstance } from 'fastify';
import { appRouter } from './router.js';

export async function registerTRPC(fastify: FastifyInstance) {
  await fastify.register(fastifyTRPCPlugin, {
    prefix: '/trpc',
    trpcOptions: {
      router: appRouter,
    },
  });
  
  fastify.log.info('[tRPC] tRPC plugin registered at /trpc');
}

