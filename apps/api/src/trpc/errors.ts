/**
 * Custom tRPC Errors
 * 커스텀 에러 클래스 및 헬퍼 함수
 */

import { TRPCError } from '@trpc/server';

/**
 * Common error creators
 */
export const AppError = {
  /**
   * User not found
   */
  userNotFound: (userId?: string) =>
    new TRPCError({
      code: 'NOT_FOUND',
      message: userId ? `User ${userId} not found` : 'User not found',
    }),

  /**
   * Game not found
   */
  gameNotFound: (gameId?: string) =>
    new TRPCError({
      code: 'NOT_FOUND',
      message: gameId ? `Game ${gameId} not found` : 'Game not found',
    }),

  /**
   * Guild not found
   */
  guildNotFound: (guildId?: string) =>
    new TRPCError({
      code: 'NOT_FOUND',
      message: guildId ? `Guild ${guildId} not found` : 'Guild not found',
    }),

  /**
   * Item not found
   */
  itemNotFound: (itemId?: string) =>
    new TRPCError({
      code: 'NOT_FOUND',
      message: itemId ? `Item ${itemId} not found` : 'Item not found',
    }),

  /**
   * Quest not found
   */
  questNotFound: (questId?: string) =>
    new TRPCError({
      code: 'NOT_FOUND',
      message: questId ? `Quest ${questId} not found` : 'Quest not found',
    }),

  /**
   * Invalid credentials
   */
  invalidCredentials: () =>
    new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid credentials',
    }),

  /**
   * Not enough resources
   */
  insufficientResources: (resource: 'gold' | 'diamonds' | 'actionPoints') =>
    new TRPCError({
      code: 'BAD_REQUEST',
      message: `Not enough ${resource}`,
    }),

  /**
   * Already exists
   */
  alreadyExists: (resource: string) =>
    new TRPCError({
      code: 'CONFLICT',
      message: `${resource} already exists`,
    }),

  /**
   * Invalid operation
   */
  invalidOperation: (message: string) =>
    new TRPCError({
      code: 'BAD_REQUEST',
      message,
    }),

  /**
   * Forbidden operation
   */
  forbidden: (message: string = 'Operation not allowed') =>
    new TRPCError({
      code: 'FORBIDDEN',
      message,
    }),

  /**
   * Internal server error
   */
  internal: (message: string = 'Internal server error', cause?: unknown) =>
    new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message,
      cause,
    }),
};

