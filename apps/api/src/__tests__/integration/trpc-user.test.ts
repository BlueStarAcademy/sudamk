/**
 * tRPC User Router integration tests
 * tRPC 사용자 라우터 통합 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../../trpc/router.js';
import { createContext } from '../../trpc/context.js';
import { getPrismaClient } from '@sudam/database';
import { hashPassword } from '../../auth/password.js';
import { generateToken } from '../../auth/jwt.js';
import type { FastifyRequest } from 'fastify';

const prisma = getPrismaClient();

// Mock FastifyRequest
const createMockRequest = (authHeader?: string): FastifyRequest => {
  return {
    headers: {
      authorization: authHeader,
    },
    log: {
      info: () => {},
      error: () => {},
      warn: () => {},
    },
  } as any;
};

describe('tRPC User Router Integration Tests', () => {
  let testUserId: string;
  let testUsername: string;
  let testNickname: string;
  let testToken: string;
  let testPasswordHash: string;

  beforeAll(async () => {
    // Create test user
    testUserId = 'test-trpc-user-' + Date.now();
    testUsername = 'testuser' + Date.now();
    testNickname = '테스트유저' + Date.now();
    testPasswordHash = await hashPassword('testpassword123');

    await prisma.user.create({
      data: {
        id: testUserId,
        nickname: testNickname,
        username: testUsername,
        email: 'test@example.com',
      },
    });

    await prisma.userCredential.create({
      data: {
        username: testUsername,
        passwordHash: testPasswordHash,
        userId: testUserId,
      },
    });

    testToken = generateToken({
      userId: testUserId,
      username: testUsername,
      isAdmin: false,
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.userCredential.deleteMany({
        where: { userId: { startsWith: 'test-trpc-user-' } },
      });
      await prisma.user.deleteMany({
        where: { id: { startsWith: 'test-trpc-user-' } },
      });
    } catch (error) {
      // Ignore errors
    }
    await prisma.$disconnect();
  });

  describe('Public Procedures', () => {
    describe('register', () => {
      it('should register a new user', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        const newUsername = 'newuser' + Date.now();
        const newNickname = '새유저' + Date.now();

        const result = await caller.user.register({
          username: newUsername,
          password: 'password123',
          nickname: newNickname,
          email: 'newuser@example.com',
        });

        expect(result.user).toBeDefined();
        expect(result.user.nickname).toBe(newNickname);
        expect(result.token).toBeDefined();

        // Cleanup
        await prisma.userCredential.deleteMany({
          where: { username: newUsername },
        });
        await prisma.user.deleteMany({
          where: { nickname: newNickname },
        });
      });

      it('should reject duplicate nickname', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        await expect(
          caller.user.register({
            username: 'duplicate' + Date.now(),
            password: 'password123',
            nickname: testNickname, // Duplicate
          })
        ).rejects.toThrow();
      });
    });

    describe('login', () => {
      it('should login with correct credentials', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        const result = await caller.user.login({
          username: testUsername,
          password: 'testpassword123',
        });

        expect(result.user).toBeDefined();
        expect(result.user.id).toBe(testUserId);
        expect(result.token).toBeDefined();
      });

      it('should reject incorrect password', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        await expect(
          caller.user.login({
            username: testUsername,
            password: 'wrongpassword',
          })
        ).rejects.toThrow();
      });

      it('should reject non-existent user', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        await expect(
          caller.user.login({
            username: 'nonexistent',
            password: 'password123',
          })
        ).rejects.toThrow();
      });
    });
  });

  describe('Protected Procedures', () => {
    describe('me', () => {
      it('should return current user', async () => {
        const caller = appRouter.createCaller(
          await createContext({
            req: createMockRequest(`Bearer ${testToken}`),
          })
        );

        const result = await caller.user.me();

        expect(result.id).toBe(testUserId);
        expect(result.nickname).toBe(testNickname);
        expect(result.username).toBe(testUsername);
      });

      it('should reject unauthenticated request', async () => {
        const caller = appRouter.createCaller(
          await createContext({ req: createMockRequest() })
        );

        await expect(caller.user.me()).rejects.toThrow('Authentication required');
      });
    });

    describe('updateProfile', () => {
      it('should update user profile', async () => {
        const caller = appRouter.createCaller(
          await createContext({
            req: createMockRequest(`Bearer ${testToken}`),
          })
        );

        const newNickname = '업데이트된닉네임' + Date.now();
        const result = await caller.user.updateProfile({
          nickname: newNickname,
        });

        expect(result.nickname).toBe(newNickname);

        // Update test nickname for cleanup
        testNickname = newNickname;
      });

      it('should reject duplicate nickname', async () => {
        // Create another user
        const otherUserId = 'test-other-user-' + Date.now();
        const otherNickname = '다른유저' + Date.now();

        await prisma.user.create({
          data: {
            id: otherUserId,
            nickname: otherNickname,
            username: 'otheruser' + Date.now(),
          },
        });

        const caller = appRouter.createCaller(
          await createContext({
            req: createMockRequest(`Bearer ${testToken}`),
          })
        );

        await expect(
          caller.user.updateProfile({
            nickname: otherNickname, // Duplicate
          })
        ).rejects.toThrow();

        // Cleanup
        await prisma.user.delete({ where: { id: otherUserId } });
      });
    });
  });
});

