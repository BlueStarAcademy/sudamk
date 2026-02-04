/**
 * Game tRPC router
 */

import { z } from 'zod';
import { router, nicknameProcedure } from '../router.js';
import { gameRepository } from '../../repositories/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

export const gameRouter = router({
  // Get active games
  getActive: nicknameProcedure.query(async () => {
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
  getById: nicknameProcedure
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
  create: nicknameProcedure
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
        const { StandardGameMode } = await import('../../game/modes/index.js');
        
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

