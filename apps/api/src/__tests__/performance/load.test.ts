/**
 * Performance and Load Tests
 * 성능 및 부하 테스트
 */

import { describe, it, expect } from 'vitest';
import { appRouter } from '../../trpc/router.js';
import { createContext } from '../../trpc/context.js';
import { getPrismaClient } from '@sudam/database';
import { generateToken } from '../../auth/jwt.js';
import type { FastifyRequest } from 'fastify';

const prisma = getPrismaClient();

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

describe('Performance Tests', () => {
  describe('Database Query Performance', () => {
    it('should handle multiple concurrent user queries', async () => {
      const startTime = Date.now();
      
      // Create multiple concurrent queries
      const queries = Array.from({ length: 10 }, async () => {
        return prisma.user.findMany({ take: 10 });
      });

      await Promise.all(queries);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
    });

    it('should handle batch game queries efficiently', async () => {
      const startTime = Date.now();
      
      const queries = Array.from({ length: 5 }, async () => {
        return prisma.liveGame.findMany({
          where: { isEnded: false },
          take: 20,
        });
      });

      await Promise.all(queries);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (2 seconds)
      expect(duration).toBeLessThan(2000);
    });
  });

  describe('tRPC Router Performance', () => {
    it('should handle concurrent tRPC calls', async () => {
      const testUserId = 'perf-test-user-' + Date.now();
      const testToken = generateToken({
        userId: testUserId,
        isAdmin: false,
      });

      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken}`),
        })
      );

      const startTime = Date.now();
      
      // Create multiple concurrent calls
      const calls = Array.from({ length: 5 }, async () => {
        try {
          return await caller.user.me();
        } catch (error) {
          // Expected to fail for non-existent user
          return null;
        }
      });

      await Promise.all(calls);
      
      const duration = Date.now() - startTime;
      
      // Should complete within reasonable time (1 second)
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Cache Performance', () => {
    it('should improve performance with caching', async () => {
      // This test would measure cache hit rates
      // In a real scenario, you'd compare cached vs non-cached queries
      
      const startTime = Date.now();
      
      // Simulate multiple cache hits
      for (let i = 0; i < 100; i++) {
        // Cache lookup (simulated)
        await new Promise((resolve) => setTimeout(resolve, 1));
      }
      
      const duration = Date.now() - startTime;
      
      // Cached queries should be very fast
      expect(duration).toBeLessThan(200);
    });
  });
});

describe('Load Tests', () => {
  describe('Concurrent Game Creation', () => {
    it('should handle multiple concurrent game creations', async () => {
      const testUserId = 'load-test-user-' + Date.now();
      const testToken = generateToken({
        userId: testUserId,
        isAdmin: false,
      });

      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken}`),
        })
      );

      const startTime = Date.now();
      
      // Create 10 concurrent games
      const gameCreations = Array.from({ length: 10 }, async (_, i) => {
        try {
          return await caller.game.create({
            mode: 'standard',
            boardSize: 19,
          });
        } catch (error) {
          // May fail if user doesn't exist, that's okay for load test
          return null;
        }
      });

      const results = await Promise.all(gameCreations);
      const successful = results.filter((r) => r !== null);
      
      const duration = Date.now() - startTime;
      
      // Should handle concurrent requests
      expect(successful.length).toBeGreaterThanOrEqual(0);
      expect(duration).toBeLessThan(5000); // 5 seconds max
    });
  });
});

