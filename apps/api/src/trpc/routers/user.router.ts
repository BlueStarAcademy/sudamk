/**
 * User tRPC router
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../router.js';
import { userRepository } from '../../repositories/index.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { generateToken } from '../../auth/jwt.js';

export const userRouter = router({
  // Register
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20),
        password: z.string().min(6),
        nickname: z.string().min(2).max(20),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Check if username exists
      const existingUser = await userRepository.findByNickname(input.nickname);
      if (existingUser) {
        throw new Error('Nickname already exists');
      }

      // Create user
      const passwordHash = await hashPassword(input.password);
      const user = await userRepository.create({
        id: crypto.randomUUID(),
        nickname: input.nickname,
        username: input.username,
        email: input.email,
        isAdmin: false,
      });

      // TODO: Create credentials
      // await credentialRepository.create({
      //   username: input.username,
      //   passwordHash,
      //   userId: user.id,
      // });

      const token = generateToken({
        userId: user.id,
        username: user.username ?? undefined,
        isAdmin: user.isAdmin,
      });

      return {
        user: {
          id: user.id,
          nickname: user.nickname,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
        },
        token,
      };
    }),

  // Login
  login: publicProcedure
    .input(
      z.object({
        username: z.string(),
        password: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      // TODO: Verify credentials
      // const credential = await credentialRepository.findByUsername(input.username);
      // if (!credential) {
      //   throw new Error('Invalid credentials');
      // }
      // const isValid = await verifyPassword(input.password, credential.passwordHash);
      // if (!isValid) {
      //   throw new Error('Invalid credentials');
      // }

      // For now, find user by username
      const user = await userRepository.findByNickname(input.username);
      if (!user) {
        throw new Error('Invalid credentials');
      }

      const token = generateToken({
        userId: user.id,
        username: user.username ?? undefined,
        isAdmin: user.isAdmin,
      });

      return {
        user: {
          id: user.id,
          nickname: user.nickname,
          username: user.username,
          email: user.email,
          isAdmin: user.isAdmin,
        },
        token,
      };
    }),

  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await userRepository.findById(ctx.user.id);
    if (!user) {
      throw new Error('User not found');
    }

    return {
      id: user.id,
      nickname: user.nickname,
      username: user.username,
      email: user.email,
      isAdmin: user.isAdmin,
      strategyLevel: user.strategyLevel,
      playfulLevel: user.playfulLevel,
      actionPointCurr: user.actionPointCurr,
      actionPointMax: user.actionPointMax,
      gold: user.gold.toString(),
      diamonds: user.diamonds.toString(),
      league: user.league,
      tournamentScore: user.tournamentScore,
      towerFloor: user.towerFloor,
    };
  }),

  // Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        nickname: z.string().min(2).max(20).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const user = await userRepository.update(ctx.user.id, input);
      return {
        id: user.id,
        nickname: user.nickname,
        email: user.email,
      };
    }),
});

