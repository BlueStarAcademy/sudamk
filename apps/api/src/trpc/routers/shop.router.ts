/**
 * Shop tRPC router
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../router.js';
import { getPrismaClient } from '@sudam/database';
import { userRepository } from '../../repositories/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

const prisma = getPrismaClient();

export const shopRouter = router({
  // Get shop items
  getItems: protectedProcedure
    .input(
      z.object({
        category: z.enum(['item', 'equipment', 'consumable']).optional(),
      })
    )
    .query(async ({ input }) => {
      // In a real implementation, you'd have a ShopItem table
      // For now, return mock data or query from a template table
      const items = await prisma.itemTemplate.findMany({
        where: input.category
          ? {
              category: input.category,
              isShopItem: true,
            }
          : {
              isShopItem: true,
            },
        take: 100,
      });

      return items.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description || '',
        priceGold: item.priceGold ? Number(item.priceGold) : null,
        priceDiamonds: item.priceDiamonds ? Number(item.priceDiamonds) : null,
        category: item.category,
      }));
    }),

  // Purchase item
  purchase: protectedProcedure
    .input(
      z.object({
        itemId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await prisma.itemTemplate.findUnique({
        where: { id: input.itemId },
      });

      try {
        if (!item || !item.isShopItem) {
          throw AppError.validationError('Item not available in shop');
        }

        const user = await userRepository.findById(ctx.user.id);
        if (!user) {
          throw AppError.userNotFound(ctx.user.id);
        }

        // Check if user has enough currency
        if (item.priceGold && user.gold < Number(item.priceGold)) {
          throw AppError.insufficientGold(Number(item.priceGold), Number(user.gold));
        }

        if (item.priceDiamonds && user.diamonds < Number(item.priceDiamonds)) {
          throw AppError.insufficientDiamonds(Number(item.priceDiamonds), Number(user.diamonds));
        }

      // Deduct currency
      if (item.priceGold) {
        await userRepository.update(user.id, {
          gold: user.gold - Number(item.priceGold),
        });
      }

      if (item.priceDiamonds) {
        await userRepository.update(user.id, {
          diamonds: user.diamonds - Number(item.priceDiamonds),
        });
      }

      // Add item to inventory
      const existingInventory = await prisma.inventory.findFirst({
        where: {
          userId: ctx.user.id,
          templateId: item.id,
        },
      });

      if (existingInventory) {
        await prisma.inventory.update({
          where: { id: existingInventory.id },
          data: {
            quantity: existingInventory.quantity + 1,
          },
        });
      } else {
        await prisma.inventory.create({
          data: {
            userId: ctx.user.id,
            templateId: item.id,
            quantity: 1,
          },
        });
      }

        return { success: true };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

