#!/usr/bin/env tsx
/**
 * Data validation script
 * Validates data integrity after migration
 */

import { PrismaClient } from '@sudam/database';

const prisma = new PrismaClient();

async function validateData() {
  console.log('[Validation] Starting data validation...');
  
  try {
    // Validate users
    const userCount = await prisma.user.count();
    console.log(`[Validation] Users: ${userCount}`);
    
    // Validate games
    const gameCount = await prisma.liveGame.count();
    const activeGameCount = await prisma.liveGame.count({
      where: { isEnded: false },
    });
    console.log(`[Validation] Total games: ${gameCount}, Active: ${activeGameCount}`);
    
    // Validate relationships
    const usersWithInventory = await prisma.user.findMany({
      include: { inventory: true },
    });
    console.log(`[Validation] Users with inventory: ${usersWithInventory.length}`);
    
    // Check for orphaned records
    const orphanedInventories = await prisma.userInventory.findMany({
      where: {
        user: null,
      },
    });
    
    if (orphanedInventories.length > 0) {
      console.warn(`[Validation] WARNING: Found ${orphanedInventories.length} orphaned inventories`);
    }
    
    console.log('[Validation] Validation completed');
  } catch (error) {
    console.error('[Validation] Error during validation:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

validateData();

