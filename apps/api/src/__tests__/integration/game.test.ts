/**
 * Game integration tests
 * 게임 관련 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@sudam/database';
import { gameRepository } from '../../repositories/index.js';
import { StandardGameMode } from '../../game/modes/index.js';

const prisma = getPrismaClient();

describe('Game Integration Tests', () => {
  let testUserId1: string;
  let testUserId2: string;
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
  });

  afterAll(async () => {
    // Clean up test data
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

  describe('Game Creation', () => {
    it('should create a game successfully', async () => {
      testGameId = 'test-game-' + Date.now();
      const gameData = StandardGameMode.initializeGame(testUserId1, testUserId2, 19);

      const game = await gameRepository.create({
        id: testGameId,
        status: 'pending',
        category: 'standard',
        data: gameData,
      });

      expect(game).toBeDefined();
      expect(game.id).toBe(testGameId);
      expect(game.status).toBe('pending');
    });

    it('should find game by ID', async () => {
      const game = await gameRepository.findById(testGameId);
      expect(game).toBeDefined();
      expect(game?.id).toBe(testGameId);
    });
  });

  describe('Game State Management', () => {
    it('should update game state', async () => {
      const game = await gameRepository.findById(testGameId);
      if (!game) throw new Error('Game not found');

      const updatedData = {
        ...(game.data as any),
        gameStatus: 'active',
        currentPlayer: 2,
      };

      const updatedGame = await gameRepository.update(testGameId, {
        data: updatedData,
        status: 'active',
      });

      expect(updatedGame.status).toBe('active');
      expect((updatedGame.data as any).gameStatus).toBe('active');
    });
  });

  describe('Game Actions', () => {
    it('should process a move', async () => {
      const game = await gameRepository.findById(testGameId);
      if (!game) throw new Error('Game not found');

      const result = await StandardGameMode.processMove(
        game,
        testUserId1,
        { x: 3, y: 3 }
      );

      expect(result.success).toBe(true);

      const updatedGame = await gameRepository.findById(testGameId);
      const gameData = updatedGame?.data as any;
      expect(gameData.boardState[3][3]).toBe(1); // Player 1's stone
    });

    it('should handle pass', async () => {
      const game = await gameRepository.findById(testGameId);
      if (!game) throw new Error('Game not found');

      const result = await StandardGameMode.handlePass(game, testUserId2);

      expect(result.success).toBe(true);

      const updatedGame = await gameRepository.findById(testGameId);
      const gameData = updatedGame?.data as any;
      expect(gameData.moveHistory.length).toBeGreaterThan(0);
    });
  });

  describe('Active Games', () => {
    it('should find active games', async () => {
      const activeGames = await gameRepository.findActive();
      expect(Array.isArray(activeGames)).toBe(true);
      
      const ourGame = activeGames.find((g) => g.id === testGameId);
      expect(ourGame).toBeDefined();
    });
  });
});

