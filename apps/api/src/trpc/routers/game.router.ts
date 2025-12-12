/**
 * Game tRPC router
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../router.js';
import { gameRepository } from '../../repositories/index.js';

export const gameRouter = router({
  // Get active games
  getActive: protectedProcedure.query(async () => {
    const games = await gameRepository.findActive();
    return games.map((game) => ({
      id: game.id,
      status: game.status,
      category: game.category,
      data: game.data,
      updatedAt: game.updatedAt,
    }));
  }),

  // Get game by ID
  getById: protectedProcedure
    .input(z.object({ gameId: z.string() }))
    .query(async ({ input }) => {
      const game = await gameRepository.findById(input.gameId);
      if (!game) {
        throw new Error('Game not found');
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
    }),

  // Create game (placeholder)
  create: protectedProcedure
    .input(
      z.object({
        mode: z.string(),
        settings: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement game creation logic
      const game = await gameRepository.create({
        id: crypto.randomUUID(),
        status: 'pending',
        data: {
          mode: input.mode,
          settings: input.settings,
          player1Id: ctx.user.id,
        },
      });
      return {
        id: game.id,
        status: game.status,
      };
    }),
});

