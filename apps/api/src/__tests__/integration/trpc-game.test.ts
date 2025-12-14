/**
 * tRPC Game Router integration tests
 * tRPC 게임 라우터 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../../trpc/router.js';
import { createContext } from '../../trpc/context.js';
import { getPrismaClient } from '@sudam/database';
import { generateToken } from '../../auth/jwt.js';
import { StandardGameMode } from '../../game/modes/index.js';
import type { FastifyRequest } from 'fastify';

const prisma = getPrismaClient();

const createMockRequest = (authHeader?: string): FastifyRequest => {
  return {
    headers: {
      authorization: authHeader,
    },
    log: {
      info: () => {},
      error: () => {},
      warn: () => {},
    },
  } as any;
};

describe('tRPC Game Router Integration Tests', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testToken1: string;
  let testToken2: string;
  let testGameId: string;

  beforeAll(async () => {
    // Create test users
    testUserId1 = 'test-game-user-1-' + Date.now();
    testUserId2 = 'test-game-user-2-' + Date.now();

    await prisma.user.createMany({
      data: [
        {
          id: testUserId1,
          nickname: 'testplayer1' + Date.now(),
        },
        {
          id: testUserId2,
          nickname: 'testplayer2' + Date.now(),
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
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.liveGame.deleteMany({
        where: {
          id: { startsWith: 'test-game-' },
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
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('should create a game', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.game.create({
        mode: 'standard',
        boardSize: 19,
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');

      testGameId = result.id;
    });

    it('should create game with player2Id', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.game.create({
        mode: 'standard',
        boardSize: 19,
        player2Id: testUserId2,
      });

      expect(result.id).toBeDefined();
      expect(result.status).toBe('pending');

      // Cleanup
      await prisma.liveGame.delete({ where: { id: result.id } });
    });
  });

  describe('getById', () => {
    it('should get game by ID', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.game.getById({
        gameId: testGameId,
      });

      expect(result.id).toBe(testGameId);
      expect(result.data).toBeDefined();
    });

    it('should throw error for non-existent game', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      await expect(
        caller.game.getById({
          gameId: 'non-existent-id',
        })
      ).rejects.toThrow();
    });
  });

  describe('getActive', () => {
    it('should get active games', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.game.getActive();

      expect(Array.isArray(result)).toBe(true);
      const ourGame = result.find((g) => g.id === testGameId);
      expect(ourGame).toBeDefined();
    });
  });
});

