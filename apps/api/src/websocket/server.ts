/**
 * WebSocket server for real-time game updates
 */

import type { FastifyInstance } from 'fastify';
import type { WebSocket } from 'ws';
import { verifyToken, type JWTPayload } from '../auth/jwt.js';

interface Connection {
  ws: WebSocket;
  userId?: string;
  gameId?: string;
}

const connections = new Map<string, Connection>();

export function setupWebSocket(fastify: FastifyInstance) {
  fastify.get('/ws', { websocket: true }, (connection, req) => {
    const ws = connection as any;
    const connectionId = `${Date.now()}-${Math.random()}`;
    
    // Authenticate connection
    const token = req.headers.authorization?.replace('Bearer ', '');
    let userId: string | undefined;
    
    if (token) {
      const payload = verifyToken(token);
      if (payload) {
        userId = payload.userId;
      }
    }
    
    connections.set(connectionId, {
      ws,
      userId,
    });
    
    fastify.log.info(`[WebSocket] Connection established: ${connectionId} (user: ${userId ?? 'anonymous'})`);
    
    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        handleMessage(connectionId, data);
      } catch (error: any) {
        fastify.log.error('[WebSocket] Error parsing message:', error as any);
      }
    });
    
    ws.on('close', () => {
      connections.delete(connectionId);
      fastify.log.info(`[WebSocket] Connection closed: ${connectionId}`);
    });
    
    ws.on('error', (error: any) => {
      fastify.log.error(`[WebSocket] Error on connection ${connectionId}:`, error as any);
      connections.delete(connectionId);
    });
  });
  
  fastify.log.info('[WebSocket] WebSocket server setup complete');
}

function handleMessage(connectionId: string, data: any) {
  const connection = connections.get(connectionId);
  if (!connection) return;
  
  // Handle different message types
  switch (data.type) {
    case 'ping':
      connection.ws.send(JSON.stringify({ type: 'pong' }));
      break;
    case 'subscribe_game':
      connection.gameId = data.gameId;
      break;
    case 'unsubscribe_game':
      connection.gameId = undefined;
      break;
    default:
      console.warn(`[WebSocket] Unknown message type: ${data.type}`);
  }
}

export function broadcastToGame(gameId: string, message: any) {
  let count = 0;
  for (const [id, conn] of connections.entries()) {
    if (conn.gameId === gameId && conn.ws.readyState === 1) { // WebSocket.OPEN
      conn.ws.send(JSON.stringify(message));
      count++;
    }
  }
  return count;
}

export function broadcastToUser(userId: string, message: any) {
  let count = 0;
  for (const [id, conn] of connections.entries()) {
    if (conn.userId === userId && conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify(message));
      count++;
    }
  }
  return count;
}

export function broadcast(message: any) {
  let count = 0;
  for (const [id, conn] of connections.entries()) {
    if (conn.ws.readyState === 1) {
      conn.ws.send(JSON.stringify(message));
      count++;
    }
  }
  return count;
}

