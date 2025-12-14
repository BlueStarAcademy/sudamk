/**
 * tRPC Game Action Router integration tests
 * tRPC 게임 액션 라우터 통합 테스트
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

describe('tRPC Game Action Router Integration Tests', () => {
  let testUserId1: string;
  let testUserId2: string;
  let testToken1: string;
  let testToken2: string;
  let testGameId: string;

  beforeAll(async () => {
    // Create test users
    testUserId1 = 'test-action-user-1-' + Date.now();
    testUserId2 = 'test-action-user-2-' + Date.now();

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

    // Create test game
    testGameId = 'test-action-game-' + Date.now();
    const gameData = StandardGameMode.initializeGame(testUserId1, testUserId2, 19);

    await prisma.liveGame.create({
      data: {
        id: testGameId,
        status: 'active',
        category: 'standard',
        data: gameData,
      },
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.liveGame.deleteMany({
        where: {
          id: { startsWith: 'test-action-game-' },
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

  describe('makeMove', () => {
    it('should make a move successfully', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.gameAction.makeMove({
        gameId: testGameId,
        x: 3,
        y: 3,
      });

      expect(result.success).toBe(true);

      // Verify move was recorded
      const game = await prisma.liveGame.findUnique({
        where: { id: testGameId },
      });
      const gameData = game?.data as any;
      expect(gameData.boardState[3][3]).toBe(1); // Player 1's stone
    });

    it('should reject move from non-player', async () => {
      const otherUserId = 'test-other-user-' + Date.now();
      await prisma.user.create({
        data: {
          id: otherUserId,
          nickname: 'otheruser' + Date.now(),
        },
      });

      const otherToken = generateToken({
        userId: otherUserId,
        isAdmin: false,
      });

      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${otherToken}`),
        })
      );

      await expect(
        caller.gameAction.makeMove({
          gameId: testGameId,
          x: 4,
          y: 4,
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.user.delete({ where: { id: otherUserId } });
    });

    it('should reject move when not player turn', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      // Player 1 just moved, so it's player 2's turn
      await expect(
        caller.gameAction.makeMove({
          gameId: testGameId,
          x: 4,
          y: 4,
        })
      ).rejects.toThrow('Not your turn');
    });
  });

  describe('pass', () => {
    it('should pass successfully', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken2}`),
        })
      );

      const result = await caller.gameAction.pass({
        gameId: testGameId,
      });

      expect(result.success).toBe(true);

      // Verify pass was recorded
      const game = await prisma.liveGame.findUnique({
        where: { id: testGameId },
      });
      const gameData = game?.data as any;
      expect(gameData.moveHistory.length).toBeGreaterThan(0);
      const lastMove = gameData.moveHistory[gameData.moveHistory.length - 1];
      expect(lastMove.x).toBe(-1); // Pass move
      expect(lastMove.y).toBe(-1);
    });
  });

  describe('resign', () => {
    it('should resign successfully', async () => {
      // Create a new game for resign test
      const resignGameId = 'test-resign-game-' + Date.now();
      const gameData = StandardGameMode.initializeGame(testUserId1, testUserId2, 19);

      await prisma.liveGame.create({
        data: {
          id: resignGameId,
          status: 'active',
          category: 'standard',
          data: gameData,
        },
      });

      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken1}`),
        })
      );

      const result = await caller.gameAction.resign({
        gameId: resignGameId,
      });

      expect(result.success).toBe(true);

      // Verify game ended
      const game = await prisma.liveGame.findUnique({
        where: { id: resignGameId },
      });
      expect(game?.isEnded).toBe(true);
      expect(game?.status).toBe('ended');
    });
  });
});

