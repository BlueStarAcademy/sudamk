/**
 * Custom error classes and error handling utilities
 * 커스텀 에러 클래스 및 에러 핸들링 유틸리티
 */

import { TRPCError } from '@trpc/server';
import type { Prisma } from '@prisma/client';

/**
 * Application error codes
 */
export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Not Found
  NOT_FOUND = 'NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  GAME_NOT_FOUND = 'GAME_NOT_FOUND',
  GUILD_NOT_FOUND = 'GUILD_NOT_FOUND',
  ITEM_NOT_FOUND = 'ITEM_NOT_FOUND',
  QUEST_NOT_FOUND = 'QUEST_NOT_FOUND',
  
  // Validation
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_INPUT = 'INVALID_INPUT',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  
  // Business Logic
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  NICKNAME_ALREADY_EXISTS = 'NICKNAME_ALREADY_EXISTS',
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',
  GUILD_NAME_ALREADY_TAKEN = 'GUILD_NAME_ALREADY_TAKEN',
  USER_ALREADY_HAS_GUILD = 'USER_ALREADY_HAS_GUILD',
  
  // Game Logic
  GAME_NOT_ACTIVE = 'GAME_NOT_ACTIVE',
  INVALID_MOVE = 'INVALID_MOVE',
  NOT_YOUR_TURN = 'NOT_YOUR_TURN',
  GAME_MODE_NOT_IMPLEMENTED = 'GAME_MODE_NOT_IMPLEMENTED',
  
  // Resources
  INSUFFICIENT_GOLD = 'INSUFFICIENT_GOLD',
  INSUFFICIENT_DIAMONDS = 'INSUFFICIENT_DIAMONDS',
  INSUFFICIENT_ITEMS = 'INSUFFICIENT_ITEMS',
  
  // Quest
  QUEST_NOT_AVAILABLE = 'QUEST_NOT_AVAILABLE',
  QUEST_ALREADY_ACCEPTED = 'QUEST_ALREADY_ACCEPTED',
  QUEST_NOT_ACTIVE = 'QUEST_NOT_ACTIVE',
  QUEST_NOT_COMPLETED = 'QUEST_NOT_COMPLETED',
  
  // Shop
  ITEM_NOT_AVAILABLE = 'ITEM_NOT_AVAILABLE',
  
  // Server
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
}

/**
 * Error metadata interface
 */
export interface ErrorMetadata {
  code: ErrorCode;
  message: string;
  statusCode?: number;
  details?: Record<string, any>;
  cause?: Error;
}

/**
 * Create a TRPCError with consistent formatting
 */
export function createTRPCError(
  code: ErrorCode,
  message: string,
  options?: {
    statusCode?: number;
    details?: Record<string, any>;
    cause?: Error;
  }
): TRPCError {
  const trpcErrorCode = mapErrorCodeToTRPC(code);
  
  const error = new TRPCError({
    code: trpcErrorCode,
    message,
    cause: options?.cause,
  });

  // Attach custom metadata
  (error as any).metadata = {
    code,
    details: options?.details,
  };

  return error;
}

/**
 * Map custom error code to TRPC error code
 */
function mapErrorCodeToTRPC(code: ErrorCode): TRPCError['code'] {
  switch (code) {
    case ErrorCode.UNAUTHORIZED:
      return 'UNAUTHORIZED';
    case ErrorCode.FORBIDDEN:
      return 'FORBIDDEN';
    case ErrorCode.NOT_FOUND:
    case ErrorCode.USER_NOT_FOUND:
    case ErrorCode.GAME_NOT_FOUND:
    case ErrorCode.GUILD_NOT_FOUND:
    case ErrorCode.ITEM_NOT_FOUND:
    case ErrorCode.QUEST_NOT_FOUND:
      return 'NOT_FOUND';
    case ErrorCode.VALIDATION_ERROR:
    case ErrorCode.INVALID_INPUT:
    case ErrorCode.INVALID_CREDENTIALS:
      return 'BAD_REQUEST';
    case ErrorCode.ALREADY_EXISTS:
    case ErrorCode.NICKNAME_ALREADY_EXISTS:
    case ErrorCode.EMAIL_ALREADY_EXISTS:
    case ErrorCode.GUILD_NAME_ALREADY_TAKEN:
    case ErrorCode.USER_ALREADY_HAS_GUILD:
      return 'CONFLICT';
    case ErrorCode.INSUFFICIENT_GOLD:
    case ErrorCode.INSUFFICIENT_DIAMONDS:
    case ErrorCode.INSUFFICIENT_ITEMS:
      return 'PRECONDITION_FAILED';
    default:
      return 'INTERNAL_SERVER_ERROR';
  }
}

/**
 * Handle Prisma errors and convert to TRPCError
 */
export function handlePrismaError(error: unknown): TRPCError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        const target = (error.meta?.target as string[]) || [];
        const field = target[0] || 'field';
        return createTRPCError(
          ErrorCode.ALREADY_EXISTS,
          `${field} already exists`,
          { details: { field, target } }
        );
      
      case 'P2025':
        // Record not found
        return createTRPCError(
          ErrorCode.NOT_FOUND,
          'Record not found',
          { cause: error }
        );
      
      case 'P2003':
        // Foreign key constraint violation
        return createTRPCError(
          ErrorCode.VALIDATION_ERROR,
          'Invalid reference',
          { cause: error }
        );
      
      default:
        return createTRPCError(
          ErrorCode.DATABASE_ERROR,
          'Database operation failed',
          { cause: error, details: { code: error.code } }
        );
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return createTRPCError(
      ErrorCode.VALIDATION_ERROR,
      'Invalid data format',
      { cause: error }
    );
  }

  // Unknown Prisma error
  return createTRPCError(
    ErrorCode.DATABASE_ERROR,
    'Database error occurred',
    { cause: error as Error }
  );
}

/**
 * Handle unknown errors and convert to TRPCError
 */
export function handleUnknownError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError || 
      error instanceof Prisma.PrismaClientValidationError) {
    return handlePrismaError(error);
  }

  if (error instanceof Error) {
    return createTRPCError(
      ErrorCode.INTERNAL_SERVER_ERROR,
      error.message || 'An unexpected error occurred',
      { cause: error }
    );
  }

  return createTRPCError(
    ErrorCode.INTERNAL_SERVER_ERROR,
    'An unexpected error occurred',
    { details: { error: String(error) } }
  );
}

/**
 * Common error creators for convenience
 */
export const AppError = {
  notFound: (resource: string, id?: string) =>
    createTRPCError(
      ErrorCode.NOT_FOUND,
      `${resource} not found${id ? `: ${id}` : ''}`,
    ),

  userNotFound: (userId?: string) =>
    createTRPCError(
      ErrorCode.USER_NOT_FOUND,
      `User not found${userId ? `: ${userId}` : ''}`,
    ),

  gameNotFound: (gameId?: string) =>
    createTRPCError(
      ErrorCode.GAME_NOT_FOUND,
      `Game not found${gameId ? `: ${gameId}` : ''}`,
    ),

  guildNotFound: (guildId?: string) =>
    createTRPCError(
      ErrorCode.GUILD_NOT_FOUND,
      `Guild not found${guildId ? `: ${guildId}` : ''}`,
    ),

  unauthorized: (message = 'Authentication required') =>
    createTRPCError(ErrorCode.UNAUTHORIZED, message),

  forbidden: (message = 'Access denied') =>
    createTRPCError(ErrorCode.FORBIDDEN, message),

  validationError: (message: string, details?: Record<string, any>) =>
    createTRPCError(ErrorCode.VALIDATION_ERROR, message, { details }),

  invalidCredentials: () =>
    createTRPCError(ErrorCode.INVALID_CREDENTIALS, 'Invalid email or password'),

  alreadyExists: (resource: string, field?: string) =>
    createTRPCError(
      ErrorCode.ALREADY_EXISTS,
      `${resource} already exists${field ? `: ${field}` : ''}`,
    ),

  nicknameExists: () =>
    createTRPCError(ErrorCode.NICKNAME_ALREADY_EXISTS, 'Nickname already taken'),

  emailExists: () =>
    createTRPCError(ErrorCode.EMAIL_ALREADY_EXISTS, 'Email already registered'),

  insufficientGold: (required?: number, available?: number) =>
    createTRPCError(
      ErrorCode.INSUFFICIENT_GOLD,
      `Not enough gold${required ? ` (required: ${required}, available: ${available || 0})` : ''}`,
      { details: { required, available } },
    ),

  insufficientDiamonds: (required?: number, available?: number) =>
    createTRPCError(
      ErrorCode.INSUFFICIENT_DIAMONDS,
      `Not enough diamonds${required ? ` (required: ${required}, available: ${available || 0})` : ''}`,
      { details: { required, available } },
    ),

  invalidMove: (message?: string) =>
    createTRPCError(ErrorCode.INVALID_MOVE, message || 'Invalid move'),

  notYourTurn: () =>
    createTRPCError(ErrorCode.NOT_YOUR_TURN, 'It is not your turn'),

  gameModeNotImplemented: (mode: string) =>
    createTRPCError(
      ErrorCode.GAME_MODE_NOT_IMPLEMENTED,
      `Game mode ${mode} is not implemented yet`,
      { details: { mode } },
    ),
};

