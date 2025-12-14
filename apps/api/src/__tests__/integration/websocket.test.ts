/**
 * WebSocket integration tests
 * WebSocket 통신 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import Fastify from 'fastify';
import { WebSocket } from 'ws';
import { getPrismaClient } from '@sudam/database';
import { generateToken } from '../../auth/jwt.js';
import { hashPassword } from '../../auth/password.js';
import { registerWebSocket } from '../../plugins/websocket.js';
import { setupWebSocket } from '../../websocket/server.js';
import { broadcastToGame, broadcastToUser } from '../../websocket/server.js';

const prisma = getPrismaClient();

describe('WebSocket Integration Tests', () => {
  let server: any;
  let testUserId1: string;
  let testUserId2: string;
  let testToken1: string;
  let testToken2: string;
  let testGameId: string;
  const port = 3001;

  beforeAll(async () => {
    // Create test users
    testUserId1 = 'test-ws-user-1-' + Date.now();
    testUserId2 = 'test-ws-user-2-' + Date.now();

    const passwordHash = await hashPassword('testpassword123');

    await prisma.user.createMany({
      data: [
        {
          id: testUserId1,
          nickname: 'testplayer1' + Date.now(),
          username: 'testplayer1' + Date.now(),
        },
        {
          id: testUserId2,
          nickname: 'testplayer2' + Date.now(),
          username: 'testplayer2' + Date.now(),
        },
      ],
    });

    await prisma.userCredential.createMany({
      data: [
        {
          username: 'testplayer1' + Date.now(),
          passwordHash,
          userId: testUserId1,
        },
        {
          username: 'testplayer2' + Date.now(),
          passwordHash,
          userId: testUserId2,
        },
      ],
    });

    testToken1 = generateToken({
      userId: testUserId1,
      isAdmin: false,
    });

    testToken2 = generateToken({
      userId: testUserId2,
      isAdmin: false,
    });

    // Create test game
    testGameId = 'test-ws-game-' + Date.now();
    await prisma.liveGame.create({
      data: {
        id: testGameId,
        status: 'active',
        category: 'standard',
        data: {
          player1Id: testUserId1,
          player2Id: testUserId2,
          currentPlayer: 1,
          boardState: Array(19).fill(null).map(() => Array(19).fill(0)),
        },
      },
    });

    // Setup Fastify server
    server = Fastify({
      logger: false, // Disable logging for tests
    });

    await registerWebSocket(server);
    setupWebSocket(server);

    await server.listen({ port, host: '127.0.0.1' });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.liveGame.deleteMany({
        where: {
          id: { startsWith: 'test-ws-game-' },
        },
      });
      await prisma.userCredential.deleteMany({
        where: {
          userId: { in: [testUserId1, testUserId2] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [testUserId1, testUserId2] },
        },
      });
    } catch (error) {
      // Ignore errors
    }

    await server.close();
    await prisma.$disconnect();
  });

  describe('WebSocket Connection', () => {
    it('should establish WebSocket connection', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should establish authenticated WebSocket connection', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken1}`,
        },
      });

      ws.on('open', () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('WebSocket Messages', () => {
    it('should handle ping message', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('open', () => {
        ws.send(JSON.stringify({ type: 'ping' }));
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe('pong');
        ws.close();
        done();
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle subscribe_game message', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken1}`,
        },
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe_game',
          gameId: testGameId,
        }));

        // Give it a moment to process
        setTimeout(() => {
          ws.close();
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });

    it('should handle unsubscribe_game message', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken1}`,
        },
      });

      ws.on('open', () => {
        ws.send(JSON.stringify({
          type: 'subscribe_game',
          gameId: testGameId,
        }));

        setTimeout(() => {
          ws.send(JSON.stringify({
            type: 'unsubscribe_game',
            gameId: testGameId,
          }));

          setTimeout(() => {
            ws.close();
            done();
          }, 100);
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('WebSocket Broadcasting', () => {
    it('should broadcast to game subscribers', (done) => {
      const ws1 = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken1}`,
        },
      });

      const ws2 = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken2}`,
        },
      });

      let ws1Ready = false;
      let ws2Ready = false;
      let ws1Received = false;
      let ws2Received = false;

      const checkDone = () => {
        if (ws1Received && ws2Received) {
          ws1.close();
          ws2.close();
          done();
        }
      };

      ws1.on('open', () => {
        ws1Ready = true;
        ws1.send(JSON.stringify({
          type: 'subscribe_game',
          gameId: testGameId,
        }));

        if (ws1Ready && ws2Ready) {
          setTimeout(() => {
            const count = broadcastToGame(testGameId, {
              type: 'GAME_UPDATE',
              payload: { test: 'data' },
            });
            expect(count).toBeGreaterThan(0);
          }, 200);
        }
      });

      ws2.on('open', () => {
        ws2Ready = true;
        ws2.send(JSON.stringify({
          type: 'subscribe_game',
          gameId: testGameId,
        }));

        if (ws1Ready && ws2Ready) {
          setTimeout(() => {
            const count = broadcastToGame(testGameId, {
              type: 'GAME_UPDATE',
              payload: { test: 'data' },
            });
            expect(count).toBeGreaterThan(0);
          }, 200);
        }
      });

      ws1.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'GAME_UPDATE') {
          ws1Received = true;
          checkDone();
        }
      });

      ws2.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'GAME_UPDATE') {
          ws2Received = true;
          checkDone();
        }
      });

      ws1.on('error', (error) => {
        done(error);
      });

      ws2.on('error', (error) => {
        done(error);
      });
    });

    it('should broadcast to user', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, {
        headers: {
          Authorization: `Bearer ${testToken1}`,
        },
      });

      ws.on('open', () => {
        setTimeout(() => {
          const count = broadcastToUser(testUserId1, {
            type: 'USER_NOTIFICATION',
            payload: { message: 'Test notification' },
          });
          expect(count).toBeGreaterThan(0);
        }, 100);
      });

      ws.on('message', (data: Buffer) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'USER_NOTIFICATION') {
          expect(message.payload.message).toBe('Test notification');
          ws.close();
          done();
        }
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });

  describe('WebSocket Connection Cleanup', () => {
    it('should cleanup connection on close', (done) => {
      const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

      ws.on('open', () => {
        ws.close();
      });

      ws.on('close', () => {
        // Connection should be cleaned up
        setTimeout(() => {
          done();
        }, 100);
      });

      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});

