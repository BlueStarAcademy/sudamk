/**
 * JWT authentication utilities
 */

import { sign, verify } from 'jsonwebtoken';
import { getEnv } from '../utils/env.js';

const env = getEnv();
const JWT_SECRET = env.JWT_SECRET || 'default-secret-change-in-production-min-32-chars';

export interface JWTPayload {
  userId: string;
  username?: string;
  isAdmin?: boolean;
}

export function generateToken(payload: JWTPayload): string {
  return sign(payload, JWT_SECRET, {
    expiresIn: '7d',
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    const decoded = verify(token, JWT_SECRET) as JWTPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) return null;
  
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  return null;
}

