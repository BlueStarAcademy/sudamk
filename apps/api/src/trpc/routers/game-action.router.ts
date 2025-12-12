/**
 * Game action tRPC router
 * Handles in-game actions (moves, passes, etc.)
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../router.js';
import { gameRepository } from '../../repositories/index.js';
import { StandardGameMode } from '../../game/modes/index.js';

export const gameActionRouter = router({
  // Make a move
  makeMove: protectedProcedure
    .input(
      z.object({
        gameId: z.string(),
        x: z.number().min(0),
        y: z.number().min(0),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const game = await gameRepository.findById(input.gameId);
      if (!game) {
        throw new Error('Game not found');
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
          throw new Error(result.error || 'Failed to process move');
        }

        return { success: true };
      }

      throw new Error(`Game mode ${gameMode} not implemented yet`);
    }),

  // Pass
  pass: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await gameRepository.findById(input.gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const gameData = game.data as any;
      const gameMode = gameData.mode || game.category || 'standard';

      if (gameMode === 'standard' || gameMode === '클래식 바둑') {
        const result = await StandardGameMode.handlePass(game, ctx.user.id);
        if (!result.success) {
          throw new Error(result.error || 'Failed to pass');
        }
        return { success: true };
      }

      throw new Error(`Game mode ${gameMode} not implemented yet`);
    }),

  // Resign
  resign: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const game = await gameRepository.findById(input.gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      const gameData = game.data as any;
      const gameMode = gameData.mode || game.category || 'standard';

      if (gameMode === 'standard' || gameMode === '클래식 바둑') {
        const result = await StandardGameMode.handleResign(game, ctx.user.id);
        return result;
      }

      throw new Error(`Game mode ${gameMode} not implemented yet`);
    }),
});

