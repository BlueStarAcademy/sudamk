/**
 * tRPC context creation
 */

import type { FastifyRequest } from 'fastify';
import { extractTokenFromHeader, verifyToken, type JWTPayload } from '../auth/jwt.js';
import { userRepository } from '../repositories/index.js';

export interface Context {
  user?: {
    id: string;
    username?: string;
    isAdmin?: boolean;
  };
  request: FastifyRequest;
}

export async function createContext(opts: { req: FastifyRequest }): Promise<Context> {
  const { req } = opts;
  
  // Extract token from Authorization header
  const authHeader = req.headers.authorization;
  const token = extractTokenFromHeader(authHeader);
  
  if (!token) {
    return { request: req };
  }
  
  // Verify token
  const payload = verifyToken(token);
  if (!payload) {
    return { request: req };
  }
  
  // Optionally verify user still exists
  const user = await userRepository.findById(payload.userId);
  if (!user) {
    return { request: req };
  }
  
  return {
    user: {
      id: user.id,
      username: user.username ?? undefined,
      isAdmin: user.isAdmin,
    },
    request: req,
  };
}

