/**
 * Inventory repository
 * Handles all inventory-related database operations
 */

import { getPrismaClient } from '@sudam/database';
import type { UserInventory, UserEquipment } from '@sudam/database';

const prisma = () => getPrismaClient();

export class InventoryRepository {
  async findByUserId(userId: string): Promise<UserInventory[]> {
    return prisma().userInventory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<UserInventory | null> {
    return prisma().userInventory.findUnique({
      where: { id },
    });
  }

  async create(data: {
    userId: string;
    templateId: string;
    quantity?: number;
    slot?: string;
    enhancementLvl?: number;
    stars?: number;
    rarity?: string;
    metadata?: any;
  }): Promise<UserInventory> {
    return prisma().userInventory.create({
      data: {
        quantity: data.quantity ?? 1,
        enhancementLvl: data.enhancementLvl ?? 0,
        stars: data.stars ?? 0,
        ...data,
      },
    });
  }

  async update(id: string, data: Partial<UserInventory>): Promise<UserInventory> {
    return prisma().userInventory.update({
      where: { id },
      data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma().userInventory.delete({
      where: { id },
    });
  }

  async getEquipment(userId: string): Promise<UserEquipment[]> {
    return prisma().userEquipment.findMany({
      where: { userId },
      include: { inventory: true },
    });
  }

  async equipItem(userId: string, slot: string, inventoryId: string): Promise<UserEquipment> {
    return prisma().userEquipment.upsert({
      where: {
        userId_slot: { userId, slot },
      },
      update: {
        inventoryId,
      },
      create: {
        userId,
        slot,
        inventoryId,
      },
    });
  }

  async unequipItem(userId: string, slot: string): Promise<void> {
    await prisma().userEquipment.delete({
      where: {
        userId_slot: { userId, slot },
      },
    });
  }
}

export const inventoryRepository = new InventoryRepository();

