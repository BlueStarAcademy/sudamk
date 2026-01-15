/**
 * Game tRPC router
 * 게임 생성 및 조회 - 각 게임은 독립적인 세션 (gameId로 격리)
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../core';
import { gameRepository } from '../../repositories/index';
import { AppError, handleUnknownError } from '../../utils/errors';

export const gameRouter = router({
  // Get active games
  getActive: protectedProcedure.query(async () => {
    try {
      const games = await gameRepository.findActive();
      return games.map((game) => ({
        id: game.id,
        status: game.status,
        category: game.category,
        data: game.data,
        updatedAt: game.updatedAt,
      }));
    } catch (error) {
      throw handleUnknownError(error);
    }
  }),

  // Get game by ID
  getById: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input }) => {
      try {
        const game = await gameRepository.findById(input.gameId);
        if (!game) {
          throw AppError.gameNotFound(input.gameId);
        }
        return {
          id: game.id,
          status: game.status,
          category: game.category,
          data: game.data,
          isEnded: game.isEnded,
          createdAt: game.createdAt,
          updatedAt: game.updatedAt,
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Create game
  create: protectedProcedure
    .input(
      z.object({
        mode: z.string().default('standard'),
        player2Id: z.string().optional(),
        boardSize: z.number().min(9).max(19).default(19),
        settings: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Import game mode initializer
        const { StandardGameMode } = await import('../../game/modes/index');
        
        // Initialize game data based on mode
        let gameData: any;
        if (input.mode === 'standard' || input.mode === '클래식 바둑') {
          gameData = StandardGameMode.initializeGame(
            ctx.user.id,
            input.player2Id,
            input.boardSize
          );
          gameData.mode = 'standard';
        } else {
          // Default to standard for now
          // TODO: Support other game modes
          gameData = StandardGameMode.initializeGame(
            ctx.user.id,
            input.player2Id,
            input.boardSize
          );
          gameData.mode = input.mode;
        }

        // Merge with additional settings
        if (input.settings) {
          gameData.settings = { ...gameData.settings, ...input.settings };
        }

        // 각 게임은 고유한 gameId로 생성되어 독립적으로 관리됨
        const game = await gameRepository.create({
          id: crypto.randomUUID(),
          status: 'pending',
          category: input.mode,
          data: gameData,
        });

        return {
          id: game.id,
          status: game.status,
          mode: input.mode,
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

