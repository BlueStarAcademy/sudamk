/**
 * Game action tRPC router
 * Handles in-game actions (moves, passes, etc.)
 */

import { z } from 'zod';
import { router, nicknameProcedure } from '../router.js';
import { gameRepository } from '../../repositories/index.js';
import { StandardGameMode } from '../../game/modes/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

export const gameActionRouter = router({
  // Make a move
  makeMove: nicknameProcedure
    .input(
      z.object({
        gameId: z.string(),
        x: z.number().min(0),
        y: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const game = await gameRepository.findById(input.gameId);
        if (!game) {
          throw AppError.gameNotFound(input.gameId);
        }

        // Determine game mode and process move
        const gameData = game.data as any;
        const gameMode = gameData.mode || game.category || 'standard';

        if (gameMode === 'standard' || gameMode === '클래식 바둑') {
          const result = await StandardGameMode.processMove(game, ctx.user.id, {
            x: input.x,
            y: input.y,
          });

          if (!result.success) {
            throw AppError.invalidMove(result.error || 'Failed to process move');
          }

          return { success: true };
        }

        throw AppError.gameModeNotImplemented(gameMode);
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Pass
  pass: nicknameProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const game = await gameRepository.findById(input.gameId);
        if (!game) {
          throw AppError.gameNotFound(input.gameId);
        }

        const gameData = game.data as any;
        const gameMode = gameData.mode || game.category || 'standard';

        if (gameMode === 'standard' || gameMode === '클래식 바둑') {
          const result = await StandardGameMode.handlePass(game, ctx.user.id);
          if (!result.success) {
            throw AppError.invalidMove(result.error || 'Failed to pass');
          }
          return { success: true };
        }

        throw AppError.gameModeNotImplemented(gameMode);
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Resign
  resign: nicknameProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const game = await gameRepository.findById(input.gameId);
        if (!game) {
          throw AppError.gameNotFound(input.gameId);
        }

        const gameData = game.data as any;
        const gameMode = gameData.mode || game.category || 'standard';

        if (gameMode === 'standard' || gameMode === '클래식 바둑') {
          const result = await StandardGameMode.handleResign(game, ctx.user.id);
          return result;
        }

        throw AppError.gameModeNotImplemented(gameMode);
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

