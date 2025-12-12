#!/usr/bin/env tsx
/**
 * Data migration script
 * Migrates data from old database structure to new structure
 */

import { PrismaClient as OldPrismaClient } from '../../../generated/prisma';
import { PrismaClient as NewPrismaClient } from '@sudam/database';

const oldPrisma = new OldPrismaClient();
const newPrisma = new NewPrismaClient();

async function migrateUsers() {
  console.log('[Migration] Migrating users...');
  const users = await oldPrisma.user.findMany();
  
  for (const user of users) {
    await newPrisma.user.upsert({
      where: { id: user.id },
      update: {
        nickname: user.nickname,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        strategyLevel: user.strategyLevel,
        strategyXp: user.strategyXp,
        playfulLevel: user.playfulLevel,
        playfulXp: user.playfulXp,
        actionPointCurr: user.actionPointCurr,
        actionPointMax: user.actionPointMax,
        gold: user.gold,
        diamonds: user.diamonds,
        league: user.league,
        tournamentScore: user.tournamentScore,
        towerFloor: user.towerFloor,
        lastTowerClearTime: user.lastTowerClearTime,
        monthlyTowerFloor: user.monthlyTowerFloor,
        status: user.status,
      },
      create: {
        id: user.id,
        nickname: user.nickname,
        username: user.username,
        email: user.email,
        isAdmin: user.isAdmin,
        strategyLevel: user.strategyLevel,
        strategyXp: user.strategyXp,
        playfulLevel: user.playfulLevel,
        playfulXp: user.playfulXp,
        actionPointCurr: user.actionPointCurr,
        actionPointMax: user.actionPointMax,
        gold: user.gold,
        diamonds: user.diamonds,
        league: user.league,
        tournamentScore: user.tournamentScore,
        towerFloor: user.towerFloor,
        lastTowerClearTime: user.lastTowerClearTime,
        monthlyTowerFloor: user.monthlyTowerFloor,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        version: user.version,
      },
    });
  }
  
  console.log(`[Migration] Migrated ${users.length} users`);
}

async function migrateGames() {
  console.log('[Migration] Migrating games...');
  const games = await oldPrisma.liveGame.findMany();
  
  for (const game of games) {
    await newPrisma.liveGame.upsert({
      where: { id: game.id },
      update: {
        status: game.status,
        category: game.category,
        isEnded: game.isEnded,
        data: game.data,
      },
      create: {
        id: game.id,
        status: game.status,
        category: game.category,
        isEnded: game.isEnded,
        data: game.data,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
      },
    });
  }
  
  console.log(`[Migration] Migrated ${games.length} games`);
}

async function migrateAll() {
  console.log('[Migration] Starting data migration...');
  
  try {
    await migrateUsers();
    await migrateGames();
    // Add more migration functions as needed
    
    console.log('[Migration] Migration completed successfully');
  } catch (error) {
    console.error('[Migration] Error during migration:', error);
    process.exit(1);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

migrateAll();

