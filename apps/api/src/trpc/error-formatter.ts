/**
 * tRPC Error Formatter
 * 에러 포맷터 - 클라이언트에 전달되는 에러 형식 정의
 */

import { TRPCError } from '@trpc/server';
import type { FastifyLoggerInstance } from 'fastify';

export function formatError(opts: {
  error: TRPCError;
  type: 'query' | 'mutation' | 'subscription';
  path: string | undefined;
  input: unknown;
  ctx: unknown;
}) {
  const { error, path, ctx } = opts;
  const logger = (ctx as { logger?: FastifyLoggerInstance })?.logger;

  // Log error details
  if (logger) {
    const errorDetails = {
      code: error.code,
      message: error.message,
      path,
      cause: error.cause,
    };

    if (error.code === 'INTERNAL_SERVER_ERROR') {
      logger.error(errorDetails, '[tRPC] Internal server error');
    } else {
      logger.warn(errorDetails, '[tRPC] Client error');
    }
  }

  // In production, hide internal error details
  const isDevelopment = process.env.NODE_ENV === 'development';

  return {
    message: error.message,
    code: error.code,
    ...(isDevelopment && {
      data: {
        code: error.code,
        httpStatus: getHTTPStatusCodeFromError(error),
        path,
        stack: error.stack,
        cause: error.cause,
      },
    }),
  };
}

function getHTTPStatusCodeFromError(error: TRPCError): number {
  switch (error.code) {
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'TIMEOUT':
      return 408;
    case 'CONFLICT':
      return 409;
    case 'PRECONDITION_FAILED':
      return 412;
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'UNPROCESSABLE_CONTENT':
      return 422;
    case 'TOO_MANY_REQUESTS':
      return 429;
    case 'CLIENT_CLOSED_REQUEST':
      return 499;
    case 'INTERNAL_SERVER_ERROR':
      return 500;
    default:
      return 500;
  }
}

