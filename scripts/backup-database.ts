#!/usr/bin/env tsx
/**
 * Database backup script
 * Backs up the existing database before migration
 */

import { PrismaClient } from '@sudam/database';
import { writeFile } from 'fs/promises';
import { join } from 'path';

const prisma = new PrismaClient();

async function backupDatabase() {
  console.log('[Backup] Starting database backup...');
  
  try {
    // Backup users
    const users = await prisma.user.findMany();
    console.log(`[Backup] Found ${users.length} users`);
    
    // Backup games
    const games = await prisma.liveGame.findMany();
    console.log(`[Backup] Found ${games.length} games`);
    
    // Backup other data
    const guilds = await prisma.guild.findMany();
    const inventories = await prisma.userInventory.findMany();
    const equipment = await prisma.userEquipment.findMany();
    
    const backup = {
      timestamp: new Date().toISOString(),
      users,
      games,
      guilds,
      inventories,
      equipment,
    };
    
    const backupPath = join(process.cwd(), 'backups', `backup-${Date.now()}.json`);
    await writeFile(backupPath, JSON.stringify(backup, null, 2));
    
    console.log(`[Backup] Backup saved to ${backupPath}`);
    console.log('[Backup] Backup completed successfully');
  } catch (error) {
    console.error('[Backup] Error during backup:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

backupDatabase();

