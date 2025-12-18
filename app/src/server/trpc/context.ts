/**
 * tRPC context creation for Next.js
 */

import { extractTokenFromHeader, verifyToken } from '../auth/jwt.js';
import { userRepository } from '../repositories/index.js';

export interface Context {
  user?: {
    id: string;
    username?: string;
    isAdmin?: boolean;
  };
  request: Request;
}

export async function createContext(opts: { req: Request }): Promise<Context> {
  const { req } = opts;
  
  // Extract token from Authorization header
  const authHeader = req.headers.get('authorization');
  const token = extractTokenFromHeader(authHeader ?? undefined);
  
  if (!token) {
    return { request: req };
  }
  
  // Verify token
  const payload = verifyToken(token);
  if (!payload) {
    return { request: req };
  }
  
  // Optionally verify user still exists (기본 정보만 로드하여 최적화)
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

