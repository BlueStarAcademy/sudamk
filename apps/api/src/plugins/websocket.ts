/**
 * WebSocket plugin configuration
 */

import websocket from '@fastify/websocket';
import type { FastifyInstance } from 'fastify';

export async function registerWebSocket(fastify: FastifyInstance) {
  await fastify.register(websocket);
  
  // WebSocket connection handler will be registered in the main server file
  fastify.log.info('[WebSocket] WebSocket plugin registered');
}

