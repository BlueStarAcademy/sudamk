/**
 * Admin tRPC router
 * 관리자 전용 API
 */

import { z } from 'zod';
import { router, adminProcedure } from '../router.js';
import { userRepository, gameRepository } from '../../repositories/index.js';
import { getPrismaClient } from '@sudam/database';

const prisma = getPrismaClient();

export const adminRouter = router({
  // Get all users (with pagination and search)
  getUsers: adminProcedure
    .input(
      z.object({
        search: z.string().optional(),
        skip: z.number().default(0),
        take: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const where = input.search
        ? {
            OR: [
              { nickname: { contains: input.search, mode: 'insensitive' as const } },
              { email: { contains: input.search, mode: 'insensitive' as const } },
              { username: { contains: input.search, mode: 'insensitive' as const } },
            ],
          }
        : undefined;

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            nickname: true,
            username: true,
            email: true,
            isAdmin: true,
            strategyLevel: true,
            playfulLevel: true,
            gold: true,
            diamonds: true,
            league: true,
            tournamentScore: true,
            createdAt: true,
          },
        }),
        prisma.user.count({ where }),
      ]);

      return {
        users: users.map((user) => ({
          ...user,
          gold: user.gold.toString(),
          diamonds: user.diamonds.toString(),
        })),
        total,
        skip: input.skip,
        take: input.take,
      };
    }),

  // Update user
  updateUser: adminProcedure
    .input(
      z.object({
        userId: z.string(),
        data: z.object({
          nickname: z.string().optional(),
          email: z.string().email().optional(),
          isAdmin: z.boolean().optional(),
          strategyLevel: z.number().optional(),
          playfulLevel: z.number().optional(),
          gold: z.string().optional(),
          diamonds: z.string().optional(),
        }),
      })
    )
    .mutation(async ({ input }) => {
      const updateData: any = { ...input.data };
      
      if (updateData.gold) {
        updateData.gold = BigInt(updateData.gold);
      }
      if (updateData.diamonds) {
        updateData.diamonds = BigInt(updateData.diamonds);
      }

      const user = await userRepository.update(input.userId, updateData);
      return {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
        isAdmin: user.isAdmin,
      };
    }),

  // Delete user
  deleteUser: adminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Prevent self-deletion
      if (input.userId === ctx.user.id) {
        throw new Error('Cannot delete yourself');
      }

      await userRepository.delete(input.userId);
      return { success: true };
    }),

  // Get all games
  getAllGames: adminProcedure
    .input(
      z.object({
        status: z.enum(['active', 'pending', 'ended']).optional(),
        skip: z.number().default(0),
        take: z.number().default(50),
      })
    )
    .query(async ({ input }) => {
      const where = input.status ? { status: input.status } : undefined;

      const [games, total] = await Promise.all([
        prisma.game.findMany({
          where,
          skip: input.skip,
          take: input.take,
          orderBy: { createdAt: 'desc' },
        }),
        prisma.game.count({ where }),
      ]);

      return {
        games,
        total,
        skip: input.skip,
        take: input.take,
      };
    }),

  // End game
  endGame: adminProcedure
    .input(z.object({ gameId: z.string() }))
    .mutation(async ({ input }) => {
      const game = await gameRepository.findById(input.gameId);
      if (!game) {
        throw new Error('Game not found');
      }

      await gameRepository.update(input.gameId, {
        status: 'ended',
        isEnded: true,
      });

      return { success: true };
    }),

  // Get system stats
  getSystemStats: adminProcedure.query(async () => {
    const [userCount, gameCount, activeGameCount, guildCount] = await Promise.all([
      prisma.user.count(),
      prisma.game.count(),
      prisma.game.count({ where: { status: 'active' } }),
      prisma.guild.count(),
    ]);

    return {
      users: userCount,
      games: gameCount,
      activeGames: activeGameCount,
      guilds: guildCount,
    };
  }),
});

