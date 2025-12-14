/**
 * End-to-End Game Flow Tests
 * 게임 플레이 전체 플로우 E2E 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../../trpc/router.js';
import { createContext } from '../../trpc/context.js';
import { getPrismaClient } from '@sudam/database';
import { generateToken } from '../../auth/jwt.js';
import { hashPassword } from '../../auth/password.js';
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

describe('E2E Game Flow Tests', () => {
  let player1Id: string;
  let player2Id: string;
  let player1Token: string;
  let player2Token: string;
  let gameId: string;

  beforeAll(async () => {
    // Create two players
    player1Id = 'e2e-player-1-' + Date.now();
    player2Id = 'e2e-player-2-' + Date.now();
    const passwordHash = await hashPassword('password123');

    await prisma.user.createMany({
      data: [
        {
          id: player1Id,
          nickname: 'e2eplayer1' + Date.now(),
          username: 'e2eplayer1' + Date.now(),
        },
        {
          id: player2Id,
          nickname: 'e2eplayer2' + Date.now(),
          username: 'e2eplayer2' + Date.now(),
        },
      ],
    });

    await prisma.userCredential.createMany({
      data: [
        {
          username: 'e2eplayer1' + Date.now(),
          passwordHash,
          userId: player1Id,
        },
        {
          username: 'e2eplayer2' + Date.now(),
          passwordHash,
          userId: player2Id,
        },
      ],
    });

    player1Token = generateToken({
      userId: player1Id,
      isAdmin: false,
    });

    player2Token = generateToken({
      userId: player2Id,
      isAdmin: false,
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.liveGame.deleteMany({
        where: {
          id: { startsWith: 'e2e-game-' },
        },
      });
      await prisma.userCredential.deleteMany({
        where: {
          userId: { in: [player1Id, player2Id] },
        },
      });
      await prisma.user.deleteMany({
        where: {
          id: { in: [player1Id, player2Id] },
        },
      });
    } catch (error) {
      // Ignore errors
    }
    await prisma.$disconnect();
  });

  describe('Complete Game Flow', () => {
    it('should complete a full game from creation to end', async () => {
      // Step 1: Player 1 creates a game
      const caller1 = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${player1Token}`),
        })
      );

      const createResult = await caller1.game.create({
        mode: 'standard',
        boardSize: 19,
        player2Id: player2Id,
      });

      expect(createResult.id).toBeDefined();
      gameId = createResult.id;

      // Step 2: Both players can see the game
      const caller2 = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${player2Token}`),
        })
      );

      const game1 = await caller1.game.getById({ gameId });
      const game2 = await caller2.game.getById({ gameId });

      expect(game1.id).toBe(gameId);
      expect(game2.id).toBe(gameId);

      // Step 3: Player 1 makes first move
      const move1Result = await caller1.gameAction.makeMove({
        gameId,
        x: 3,
        y: 3,
      });
      expect(move1Result.success).toBe(true);

      // Verify move was recorded
      const gameAfterMove1 = await caller1.game.getById({ gameId });
      const gameData1 = gameAfterMove1.data as any;
      expect(gameData1.boardState[3][3]).toBe(1); // Player 1's stone
      expect(gameData1.currentPlayer).toBe(2); // Turn switched to player 2

      // Step 4: Player 2 makes a move
      const move2Result = await caller2.gameAction.makeMove({
        gameId,
        x: 15,
        y: 15,
      });
      expect(move2Result.success).toBe(true);

      // Verify move was recorded
      const gameAfterMove2 = await caller2.game.getById({ gameId });
      const gameData2 = gameAfterMove2.data as any;
      expect(gameData2.boardState[15][15]).toBe(2); // Player 2's stone
      expect(gameData2.currentPlayer).toBe(1); // Turn switched back to player 1
      expect(gameData2.moveHistory.length).toBe(2);

      // Step 5: Player 1 passes
      const passResult = await caller1.gameAction.pass({
        gameId,
      });
      expect(passResult.success).toBe(true);

      // Step 6: Player 2 passes (game should end)
      const pass2Result = await caller2.gameAction.pass({
        gameId,
      });
      expect(pass2Result.success).toBe(true);

      // Verify game ended
      const finalGame = await caller1.game.getById({ gameId });
      expect(finalGame.isEnded).toBe(true);
      expect(finalGame.status).toBe('ended');

      const finalGameData = finalGame.data as any;
      expect(finalGameData.gameStatus).toBe('ended');
      expect(finalGameData.moveHistory.length).toBeGreaterThan(2);
    });

    it('should handle resign flow', async () => {
      // Create a new game
      const caller1 = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${player1Token}`),
        })
      );

      const createResult = await caller1.game.create({
        mode: 'standard',
        boardSize: 19,
        player2Id: player2Id,
      });

      const resignGameId = createResult.id;

      // Player 1 makes a move
      await caller1.gameAction.makeMove({
        gameId: resignGameId,
        x: 3,
        y: 3,
      });

      // Player 2 resigns
      const caller2 = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${player2Token}`),
        })
      );

      const resignResult = await caller2.gameAction.resign({
        gameId: resignGameId,
      });
      expect(resignResult.success).toBe(true);

      // Verify game ended
      const finalGame = await caller1.game.getById({ gameId: resignGameId });
      expect(finalGame.isEnded).toBe(true);
      expect(finalGame.status).toBe('ended');
    });

    it('should prevent invalid moves', async () => {
      // Create a new game
      const caller1 = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${player1Token}`),
        })
      );

      const createResult = await caller1.game.create({
        mode: 'standard',
        boardSize: 19,
        player2Id: player2Id,
      });

      const testGameId = createResult.id;

      // Player 1 makes a move
      await caller1.gameAction.makeMove({
        gameId: testGameId,
        x: 3,
        y: 3,
      });

      // Player 1 tries to move again (should fail - not their turn)
      await expect(
        caller1.gameAction.makeMove({
          gameId: testGameId,
          x: 4,
          y: 4,
        })
      ).rejects.toThrow('Not your turn');

      // Player 1 tries to move to occupied position (should fail)
      await expect(
        caller1.gameAction.makeMove({
          gameId: testGameId,
          x: 3,
          y: 3, // Already occupied
        })
      ).rejects.toThrow();

      // Cleanup
      await prisma.liveGame.delete({ where: { id: testGameId } });
    });
  });

  describe('User Registration and Login Flow', () => {
    it('should complete registration and login flow', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(),
        })
      );

      const newUsername = 'newuser' + Date.now();
      const newNickname = '새유저' + Date.now();

      // Register
      const registerResult = await caller.user.register({
        username: newUsername,
        password: 'password123',
        nickname: newNickname,
        email: 'newuser@example.com',
      });

      expect(registerResult.user).toBeDefined();
      expect(registerResult.token).toBeDefined();

      const newUserId = registerResult.user.id;

      // Login
      const loginResult = await caller.user.login({
        username: newUsername,
        password: 'password123',
      });

      expect(loginResult.user.id).toBe(newUserId);
      expect(loginResult.token).toBeDefined();

      // Get user info with token
      const newToken = loginResult.token;
      const authenticatedCaller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${newToken}`),
        })
      );

      const meResult = await authenticatedCaller.user.me();
      expect(meResult.id).toBe(newUserId);
      expect(meResult.nickname).toBe(newNickname);

      // Cleanup
      await prisma.userCredential.deleteMany({
        where: { userId: newUserId },
      });
      await prisma.user.delete({ where: { id: newUserId } });
    });
  });
});

