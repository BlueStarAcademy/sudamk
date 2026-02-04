/**
 * User tRPC router
 */

import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../router.js';
import { userRepository, credentialRepository } from '../../repositories/index.js';
import { hashPassword, verifyPassword } from '../../auth/password.js';
import { generateToken } from '../../auth/jwt.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';
import { validateNickname } from '@sudam/shared';

export const userRouter = router({
  // Register
  register: publicProcedure
    .input(
      z.object({
        username: z.string().min(3).max(20),
        password: z.string().min(6),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Check if username exists (credentials are keyed by username)
        const existingCredential = await credentialRepository.findByUsername(input.username);
        if (existingCredential) throw AppError.alreadyExists('username', 'username');

        // Create user
        const passwordHash = await hashPassword(input.password);
        const user = await userRepository.create({
          id: crypto.randomUUID(),
          username: input.username,
          isAdmin: false,
        });

        // Create credentials
        await credentialRepository.create({
          username: input.username,
          passwordHash,
          userId: user.id,
        });

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
      } catch (error) {
        throw handleUnknownError(error);
      }
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
      try {
        // Verify credentials
        const credential = await credentialRepository.findByUsername(input.username);
        if (!credential) {
          throw AppError.invalidCredentials();
        }

        if (!credential.passwordHash) {
          throw AppError.validationError('Password not set');
        }

        const isValid = await verifyPassword(input.password, credential.passwordHash);
        if (!isValid) {
          throw AppError.invalidCredentials();
        }

        const user = credential.user;
        if (!user) {
          throw AppError.userNotFound();
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
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Get current user
  me: protectedProcedure.query(async ({ ctx }) => {
    try {
      const user = await userRepository.findById(ctx.user.id);
      if (!user) {
        throw AppError.userNotFound(ctx.user.id);
      }

      return {
        id: user.id,
        nickname: user.nickname ?? null,
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
    } catch (error) {
      throw handleUnknownError(error);
    }
  }),

  // Set nickname (first time only)
  setNickname: protectedProcedure
    .input(
      z.object({
        nickname: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await userRepository.findById(ctx.user.id);
        if (!user) throw AppError.userNotFound(ctx.user.id);

        // Only allow setting once
        if (user.nickname) {
          throw AppError.forbidden('Nickname can only be set once');
        }

        const validation = validateNickname(input.nickname);
        if (!validation.ok) {
          if (validation.reason === 'format') {
            throw AppError.validationError('Nickname must be Korean (1~6 characters)');
          }
          if (validation.reason === 'reserved') {
            throw AppError.validationError('Nickname is not allowed');
          }
          if (validation.reason === 'profanity') {
            throw AppError.validationError('Nickname is not allowed');
          }
        }

        // Check if nickname is already taken
        const existing = await userRepository.findByNickname(input.nickname);
        if (existing) throw AppError.nicknameExists();

        const updatedUser = await userRepository.update(ctx.user.id, {
          nickname: input.nickname,
        });

        return {
          id: updatedUser.id,
          nickname: updatedUser.nickname ?? null,
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Update profile
  updateProfile: protectedProcedure
    .input(
      z.object({
        nickname: z.string().optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const user = await userRepository.findById(ctx.user.id);
        if (!user) {
          throw AppError.userNotFound(ctx.user.id);
        }

        // Nickname can only be set once (same rule as setNickname)
        if (input.nickname && input.nickname !== user.nickname) {
          if (user.nickname) {
            throw AppError.forbidden('Nickname can only be set once');
          }

          const validation = validateNickname(input.nickname);
          if (!validation.ok) {
            throw AppError.validationError('Nickname is not allowed');
          }

          const existingUser = await userRepository.findByNickname(input.nickname);
          if (existingUser && existingUser.id !== ctx.user.id) throw AppError.nicknameExists();
        }

        // Check if email is already taken
        if (input.email && input.email !== user.email) {
          const existingUser = await userRepository.findByEmail(input.email);
          if (existingUser && existingUser.id !== ctx.user.id) {
            throw AppError.emailExists();
          }
        }

        const updatedUser = await userRepository.update(ctx.user.id, {
          nickname: input.nickname,
          email: input.email,
        });

        return {
          id: updatedUser.id,
          nickname: updatedUser.nickname ?? null,
          email: updatedUser.email,
        };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

