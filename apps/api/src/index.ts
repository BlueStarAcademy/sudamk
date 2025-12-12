/**
 * SUDAM v2 Backend API
 * Fastify + tRPC server
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

const server = Fastify({
  logger: true,
});

// Register plugins
await server.register(cors, {
  origin: true,
});

await server.register(websocket);

// Health check
server.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 4000;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`[Server] Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();

