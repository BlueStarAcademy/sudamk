/**
 * Shop tRPC router
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../router';
import { getPrismaClient } from '@sudam/database';
import { userRepository, inventoryRepository } from '../../repositories/index';
import { AppError, handleUnknownError } from '../../utils/errors';

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
      try {
        const item = await prisma.itemTemplate.findUnique({
          where: { id: input.itemId },
        });

        if (!item || !item.isShopItem) {
          throw AppError.validationError('Item not available in shop');
        }

        const user = await userRepository.findById(ctx.user.id);
        if (!user) {
          throw AppError.userNotFound(ctx.user.id);
        }

        // Check if user has enough currency
        if (item.priceGold && user.gold < BigInt(item.priceGold)) {
          throw AppError.insufficientGold(Number(item.priceGold), Number(user.gold));
        }

        if (item.priceDiamonds && user.diamonds < BigInt(item.priceDiamonds)) {
          throw AppError.insufficientDiamonds(Number(item.priceDiamonds), Number(user.diamonds));
        }

        // Deduct currency
        if (item.priceGold) {
          await userRepository.update(user.id, {
            gold: user.gold - BigInt(item.priceGold),
          });
        }

        if (item.priceDiamonds) {
          await userRepository.update(user.id, {
            diamonds: user.diamonds - BigInt(item.priceDiamonds),
          });
        }

        // Add item to inventory
        await inventoryRepository.create({
          userId: ctx.user.id,
          templateId: item.id,
          quantity: 1,
        });

        return { success: true };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),
});

