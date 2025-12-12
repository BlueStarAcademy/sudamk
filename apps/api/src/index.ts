/**
 * SUDAM v2 Backend API
 * Fastify + tRPC server
 */

import Fastify from 'fastify';
import { configureLogger } from './plugins/logger.js';
import { registerCors } from './plugins/cors.js';
import { registerWebSocket } from './plugins/websocket.js';
import { validateEnv, getEnv } from './utils/env.js';

// Validate environment variables
if (!validateEnv()) {
  console.error('[Server] Environment validation failed. Exiting...');
  process.exit(1);
}

const env = getEnv();

const server = Fastify({
  logger: configureLogger(),
});

// Register plugins
await server.register(registerCors);
await server.register(registerWebSocket);

// Setup WebSocket server
const { setupWebSocket } = await import('./websocket/server.js');
setupWebSocket(server);

// Register tRPC
const { registerTRPC } = await import('./trpc/fastify-plugin.js');
await server.register(registerTRPC);

// Health check endpoint (must be early for Railway health checks)
server.get('/health', async () => {
  return {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  };
});

// API routes will be registered here
server.get('/api', async () => {
  return {
    name: 'SUDAM v2 API',
    version: '2.0.0',
    status: 'running',
  };
});

// Error handlers
server.setErrorHandler((error, request, reply) => {
  server.log.error(error);
  
  reply.status(error.statusCode || 500).send({
    error: {
      message: error.message,
      statusCode: error.statusCode || 500,
    },
  });
});

// Start game loop
const { startGameLoop, stopGameLoop } = await import('./background/game-loop.js');

// Start server
const start = async () => {
  try {
    await server.listen({ port: env.PORT, host: '0.0.0.0' });
    server.log.info(`[Server] Server listening on port ${env.PORT}`);
    server.log.info(`[Server] Environment: ${env.NODE_ENV}`);
    
    // Start game loop after server is ready
    startGameLoop();
    server.log.info('[Server] Game loop started');
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async () => {
  server.log.info('[Server] Shutting down gracefully...');
  stopGameLoop();
  await server.close();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

start();

