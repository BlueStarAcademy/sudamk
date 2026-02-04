/**
 * Inventory tRPC router
 */

import { z } from 'zod';
import { router, nicknameProcedure } from '../router.js';
import { inventoryRepository } from '../../repositories/index.js';
import { AppError, handleUnknownError } from '../../utils/errors.js';

export const inventoryRouter = router({
  // Get user inventory
  getMyInventory: nicknameProcedure.query(async ({ ctx }) => {
    const items = await inventoryRepository.findByUserId(ctx.user.id);
    return items.map((item) => ({
      id: item.id,
      templateId: item.templateId,
      quantity: item.quantity,
      slot: item.slot,
      enhancementLvl: item.enhancementLvl,
      stars: item.stars,
      rarity: item.rarity,
      metadata: item.metadata,
      isEquipped: item.isEquipped,
      createdAt: item.createdAt,
    }));
  }),

  // Get equipment
  getMyEquipment: nicknameProcedure.query(async ({ ctx }) => {
    const equipment = await inventoryRepository.getEquipment(ctx.user.id);
    return equipment.map((eq) => ({
      slot: eq.slot,
      inventoryId: eq.inventoryId,
      inventory: eq.inventory
        ? {
            id: eq.inventory.id,
            templateId: eq.inventory.templateId,
            enhancementLvl: eq.inventory.enhancementLvl,
            stars: eq.inventory.stars,
            rarity: eq.inventory.rarity,
          }
        : null,
    }));
  }),

  // Equip item
  equip: nicknameProcedure
    .input(
      z.object({
        inventoryId: z.string(),
        slot: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Verify item belongs to user
        const item = await inventoryRepository.findById(input.inventoryId);
        if (!item || item.userId !== ctx.user.id) {
          throw AppError.notFound('Item', input.inventoryId);
        }

        // Equip item
        await inventoryRepository.equipItem(ctx.user.id, input.slot, input.inventoryId);

        // Update item's isEquipped status
        await inventoryRepository.update(input.inventoryId, {
          isEquipped: true,
        });

        return { success: true };
      } catch (error) {
        throw handleUnknownError(error);
      }
    }),

  // Unequip item
  unequip: nicknameProcedure
    .input(z.object({ slot: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await inventoryRepository.unequipItem(ctx.user.id, input.slot);
      return { success: true };
    }),

  // Add item (admin only, or for testing)
  addItem: nicknameProcedure
    .input(
      z.object({
        templateId: z.string(),
        quantity: z.number().default(1),
        slot: z.string().optional(),
        enhancementLvl: z.number().default(0),
        stars: z.number().default(0),
        rarity: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await inventoryRepository.create({
        userId: ctx.user.id,
        templateId: input.templateId,
        quantity: input.quantity,
        slot: input.slot,
        enhancementLvl: input.enhancementLvl,
        stars: input.stars,
        rarity: input.rarity,
        metadata: input.metadata,
      });

      return {
        id: item.id,
        templateId: item.templateId,
        quantity: item.quantity,
      };
    }),
});

