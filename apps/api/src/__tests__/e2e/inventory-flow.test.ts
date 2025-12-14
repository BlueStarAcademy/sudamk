/**
 * End-to-End Inventory Flow Tests
 * 인벤토리 관리 전체 플로우 E2E 테스트
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { appRouter } from '../../trpc/router.js';
import { createContext } from '../../trpc/context.js';
import { getPrismaClient } from '@sudam/database';
import { generateToken } from '../../auth/jwt.js';
import { hashPassword } from '../../auth/password.js';
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

describe('E2E Inventory Flow Tests', () => {
  let testUserId: string;
  let testToken: string;

  beforeAll(async () => {
    testUserId = 'e2e-inventory-user-' + Date.now();
    const passwordHash = await hashPassword('password123');

    await prisma.user.create({
      data: {
        id: testUserId,
        nickname: 'inventoryuser' + Date.now(),
        username: 'inventoryuser' + Date.now(),
        gold: BigInt(10000),
        diamonds: BigInt(100),
      },
    });

    await prisma.userCredential.create({
      data: {
        username: 'inventoryuser' + Date.now(),
        passwordHash,
        userId: testUserId,
      },
    });

    testToken = generateToken({
      userId: testUserId,
      isAdmin: false,
    });
  });

  afterAll(async () => {
    // Cleanup
    try {
      await prisma.userInventory.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.userEquipment.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.userCredential.deleteMany({
        where: { userId: testUserId },
      });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      // Ignore errors
    }
    await prisma.$disconnect();
  });

  describe('Inventory Management Flow', () => {
    it('should get empty inventory for new user', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken}`),
        })
      );

      const inventory = await caller.inventory.getMyInventory();
      expect(Array.isArray(inventory)).toBe(true);
    });

    it('should get empty equipment for new user', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken}`),
        })
      );

      const equipment = await caller.inventory.getMyEquipment();
      expect(Array.isArray(equipment)).toBe(true);
    });
  });

  describe('Shop Purchase Flow', () => {
    it('should purchase item from shop', async () => {
      const caller = appRouter.createCaller(
        await createContext({
          req: createMockRequest(`Bearer ${testToken}`),
        })
      );

      // Get user's initial gold
      const userBefore = await caller.user.me();
      const initialGold = BigInt(userBefore.gold);

      // Get shop items
      const shopItems = await caller.shop.getItems();
      expect(Array.isArray(shopItems)).toBe(true);

      if (shopItems.length > 0) {
        const itemToBuy = shopItems[0];

        // Purchase item
        const purchaseResult = await caller.shop.purchase({
          itemId: itemToBuy.id,
        });

        expect(purchaseResult.success).toBe(true);

        // Verify gold was deducted
        const userAfter = await caller.user.me();
        const finalGold = BigInt(userAfter.gold);
        expect(finalGold).toBeLessThan(initialGold);

        // Verify item is in inventory
        const inventory = await caller.inventory.getMyInventory();
        const purchasedItem = inventory.find(
          (item) => item.templateId === itemToBuy.templateId
        );
        expect(purchasedItem).toBeDefined();
      }
    });
  });
});

