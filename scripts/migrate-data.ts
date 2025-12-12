/**
 * Data migration script
 * Migrates data from old database to new schema
 */

import { PrismaClient as OldPrismaClient } from '@prisma/client';
import { getPrismaClient } from '../packages/database/src/client.js';

// Old database connection (update with your old database URL)
const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL || '';

if (!OLD_DATABASE_URL) {
  console.error('[Migration] OLD_DATABASE_URL environment variable is required');
  process.exit(1);
}

const oldPrisma = new OldPrismaClient({
  datasources: {
    db: {
      url: OLD_DATABASE_URL,
    },
  },
});

const newPrisma = getPrismaClient();

interface MigrationStats {
  users: number;
  games: number;
  inventories: number;
  guilds: number;
  errors: string[];
}

async function migrateUsers(): Promise<number> {
  console.log('[Migration] Starting user migration...');
  
  try {
    // Fetch all users from old database
    const oldUsers = await oldPrisma.user.findMany({
      include: {
        credentials: true,
      },
    });

    let migrated = 0;
    for (const oldUser of oldUsers) {
      try {
        // Check if user already exists
        const existingUser = await newPrisma.user.findUnique({
          where: { id: oldUser.id },
        });

        if (existingUser) {
          console.log(`[Migration] User ${oldUser.id} already exists, skipping...`);
          continue;
        }

        // Create user in new database
        await newPrisma.user.create({
          data: {
            id: oldUser.id,
            nickname: oldUser.nickname,
            username: oldUser.username || null,
            email: oldUser.email || null,
            isAdmin: oldUser.isAdmin || false,
            strategyLevel: oldUser.strategyLevel || 1,
            playfulLevel: oldUser.playfulLevel || 1,
            gold: BigInt(oldUser.gold || 0),
            diamonds: BigInt(oldUser.diamonds || 0),
            league: oldUser.league || null,
            tournamentScore: oldUser.tournamentScore || 0,
            towerFloor: oldUser.towerFloor || 0,
            actionPointCurr: oldUser.actionPointCurr || 0,
            actionPointMax: oldUser.actionPointMax || 100,
            // Add other fields as needed
          },
        });

        // Migrate credentials if they exist
        if (oldUser.credentials) {
          await newPrisma.userCredential.create({
            data: {
              username: oldUser.credentials.username,
              passwordHash: oldUser.credentials.passwordHash || null,
              userId: oldUser.id,
              kakaoId: oldUser.credentials.kakaoId || null,
              emailVerified: oldUser.credentials.emailVerified || false,
            },
          });
        }

        migrated++;
        if (migrated % 10 === 0) {
          console.log(`[Migration] Migrated ${migrated} users...`);
        }
      } catch (error: any) {
        console.error(`[Migration] Error migrating user ${oldUser.id}:`, error.message);
      }
    }

    console.log(`[Migration] User migration complete: ${migrated} users migrated`);
    return migrated;
  } catch (error: any) {
    console.error('[Migration] Error in user migration:', error.message);
    throw error;
  }
}

async function migrateGames(): Promise<number> {
  console.log('[Migration] Starting game migration...');
  
  try {
    const oldGames = await oldPrisma.game.findMany({
      include: {
        players: true,
      },
    });

    let migrated = 0;
    for (const oldGame of oldGames) {
      try {
        const existingGame = await newPrisma.game.findUnique({
          where: { id: oldGame.id },
        });

        if (existingGame) {
          console.log(`[Migration] Game ${oldGame.id} already exists, skipping...`);
          continue;
        }

        await newPrisma.game.create({
          data: {
            id: oldGame.id,
            category: oldGame.category || 'standard',
            status: oldGame.status || 'pending',
            boardSize: oldGame.boardSize || 19,
            player1Id: oldGame.player1Id || null,
            player2Id: oldGame.player2Id || null,
            currentPlayer: oldGame.currentPlayer || 1,
            data: oldGame.data || {},
            createdAt: oldGame.createdAt,
            updatedAt: oldGame.updatedAt,
          },
        });

        migrated++;
        if (migrated % 10 === 0) {
          console.log(`[Migration] Migrated ${migrated} games...`);
        }
      } catch (error: any) {
        console.error(`[Migration] Error migrating game ${oldGame.id}:`, error.message);
      }
    }

    console.log(`[Migration] Game migration complete: ${migrated} games migrated`);
    return migrated;
  } catch (error: any) {
    console.error('[Migration] Error in game migration:', error.message);
    throw error;
  }
}

async function migrateInventories(): Promise<number> {
  console.log('[Migration] Starting inventory migration...');
  
  try {
    // This depends on how inventory is stored in the old database
    // Adjust based on your old schema
    const oldInventories = await oldPrisma.inventory.findMany({});

    let migrated = 0;
    for (const oldInv of oldInventories) {
      try {
        const existingInv = await newPrisma.inventory.findUnique({
          where: { id: oldInv.id },
        });

        if (existingInv) {
          continue;
        }

        await newPrisma.inventory.create({
          data: {
            id: oldInv.id,
            userId: oldInv.userId,
            templateId: oldInv.templateId,
            quantity: oldInv.quantity || 1,
            slot: oldInv.slot || null,
            enhancementLvl: oldInv.enhancementLvl || 0,
            stars: oldInv.stars || 0,
            rarity: oldInv.rarity || null,
            metadata: oldInv.metadata || {},
            isEquipped: oldInv.isEquipped || false,
            createdAt: oldInv.createdAt,
          },
        });

        migrated++;
      } catch (error: any) {
        console.error(`[Migration] Error migrating inventory ${oldInv.id}:`, error.message);
      }
    }

    console.log(`[Migration] Inventory migration complete: ${migrated} items migrated`);
    return migrated;
  } catch (error: any) {
    console.error('[Migration] Error in inventory migration:', error.message);
    throw error;
  }
}

async function migrateGuilds(): Promise<number> {
  console.log('[Migration] Starting guild migration...');
  
  try {
    const oldGuilds = await oldPrisma.guild.findMany({
      include: {
        members: true,
      },
    });

    let migrated = 0;
    for (const oldGuild of oldGuilds) {
      try {
        const existingGuild = await newPrisma.guild.findUnique({
          where: { id: oldGuild.id },
        });

        if (existingGuild) {
          continue;
        }

        await newPrisma.guild.create({
          data: {
            id: oldGuild.id,
            name: oldGuild.name,
            description: oldGuild.description || null,
            emblem: oldGuild.emblem || null,
            leaderId: oldGuild.leaderId,
            level: oldGuild.level || 1,
            experience: BigInt(oldGuild.experience || 0),
            gold: BigInt(oldGuild.gold || 0),
            settings: oldGuild.settings || {},
            createdAt: oldGuild.createdAt,
            updatedAt: oldGuild.updatedAt,
          },
        });

        // Migrate guild members
        for (const member of oldGuild.members) {
          await newPrisma.guildMember.create({
            data: {
              guildId: oldGuild.id,
              userId: member.userId,
              role: member.role || 'member',
              contributionTotal: BigInt(member.contributionTotal || 0),
              joinDate: member.joinDate || new Date(),
            },
          });
        }

        migrated++;
      } catch (error: any) {
        console.error(`[Migration] Error migrating guild ${oldGuild.id}:`, error.message);
      }
    }

    console.log(`[Migration] Guild migration complete: ${migrated} guilds migrated`);
    return migrated;
  } catch (error: any) {
    console.error('[Migration] Error in guild migration:', error.message);
    throw error;
  }
}

async function main() {
  console.log('[Migration] Starting data migration...');
  console.log(`[Migration] Old DB: ${OLD_DATABASE_URL.substring(0, 20)}...`);
  
  const stats: MigrationStats = {
    users: 0,
    games: 0,
    inventories: 0,
    guilds: 0,
    errors: [],
  };

  try {
    // Test connections
    await oldPrisma.$connect();
    console.log('[Migration] Connected to old database');
    
    await newPrisma.$connect();
    console.log('[Migration] Connected to new database');

    // Run migrations
    stats.users = await migrateUsers();
    stats.games = await migrateGames();
    stats.inventories = await migrateInventories();
    stats.guilds = await migrateGuilds();

    console.log('\n[Migration] Migration Summary:');
    console.log(`  Users: ${stats.users}`);
    console.log(`  Games: ${stats.games}`);
    console.log(`  Inventories: ${stats.inventories}`);
    console.log(`  Guilds: ${stats.guilds}`);
    console.log(`  Errors: ${stats.errors.length}`);

    if (stats.errors.length > 0) {
      console.log('\n[Migration] Errors encountered:');
      stats.errors.forEach((error) => console.log(`  - ${error}`));
    }

    console.log('\n[Migration] Migration complete!');
  } catch (error: any) {
    console.error('[Migration] Fatal error:', error);
    process.exit(1);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

// Run migration if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as migrateData };
