/**
 * Validate migration script
 * Validates that migrated data is correct
 */

import { PrismaClient as OldPrismaClient } from '@prisma/client';
import { getPrismaClient } from '../packages/database/src/client.js';

const OLD_DATABASE_URL = process.env.OLD_DATABASE_URL || '';
const newPrisma = getPrismaClient();

if (!OLD_DATABASE_URL) {
  console.error('[Validation] OLD_DATABASE_URL environment variable is required');
  process.exit(1);
}

const oldPrisma = new OldPrismaClient({
  datasources: {
    db: {
      url: OLD_DATABASE_URL,
    },
  },
});

interface ValidationResult {
  table: string;
  oldCount: number;
  newCount: number;
  match: boolean;
  errors: string[];
}

async function validateUsers(): Promise<ValidationResult> {
  const oldCount = await oldPrisma.user.count();
  const newCount = await newPrisma.user.count();
  
  const errors: string[] = [];
  
  // Sample check: verify some users exist in both
  const sampleUsers = await oldPrisma.user.findMany({ take: 10 });
  for (const oldUser of sampleUsers) {
    const newUser = await newPrisma.user.findUnique({
      where: { id: oldUser.id },
    });
    
    if (!newUser) {
      errors.push(`User ${oldUser.id} not found in new database`);
    } else if (newUser.nickname !== oldUser.nickname) {
      errors.push(`User ${oldUser.id} nickname mismatch`);
    }
  }

  return {
    table: 'users',
    oldCount,
    newCount,
    match: oldCount === newCount && errors.length === 0,
    errors,
  };
}

async function validateGames(): Promise<ValidationResult> {
  const oldCount = await oldPrisma.game.count();
  const newCount = await newPrisma.game.count();
  
  const errors: string[] = [];
  
  const sampleGames = await oldPrisma.game.findMany({ take: 10 });
  for (const oldGame of sampleGames) {
    const newGame = await newPrisma.game.findUnique({
      where: { id: oldGame.id },
    });
    
    if (!newGame) {
      errors.push(`Game ${oldGame.id} not found in new database`);
    } else if (newGame.status !== oldGame.status) {
      errors.push(`Game ${oldGame.id} status mismatch`);
    }
  }

  return {
    table: 'games',
    oldCount,
    newCount,
    match: oldCount === newCount && errors.length === 0,
    errors,
  };
}

async function validateInventories(): Promise<ValidationResult> {
  const oldCount = await oldPrisma.inventory.count();
  const newCount = await newPrisma.inventory.count();
  
  return {
    table: 'inventories',
    oldCount,
    newCount,
    match: oldCount === newCount,
    errors: [],
  };
}

async function validateGuilds(): Promise<ValidationResult> {
  const oldCount = await oldPrisma.guild.count();
  const newCount = await newPrisma.guild.count();
  
  const errors: string[] = [];
  
  const sampleGuilds = await oldPrisma.guild.findMany({ take: 5 });
  for (const oldGuild of sampleGuilds) {
    const newGuild = await newPrisma.guild.findUnique({
      where: { id: oldGuild.id },
    });
    
    if (!newGuild) {
      errors.push(`Guild ${oldGuild.id} not found in new database`);
    } else if (newGuild.name !== oldGuild.name) {
      errors.push(`Guild ${oldGuild.id} name mismatch`);
    }
  }

  return {
    table: 'guilds',
    oldCount,
    newCount,
    match: oldCount === newCount && errors.length === 0,
    errors,
  };
}

async function main() {
  console.log('[Validation] Starting validation...');
  
  try {
    await oldPrisma.$connect();
    await newPrisma.$connect();

    const results: ValidationResult[] = [];
    
    results.push(await validateUsers());
    results.push(await validateGames());
    results.push(await validateInventories());
    results.push(await validateGuilds());

    console.log('\n[Validation] Validation Results:');
    console.log('─'.repeat(60));
    
    let allMatch = true;
    for (const result of results) {
      const status = result.match ? '✓' : '✗';
      console.log(`${status} ${result.table.padEnd(15)} Old: ${result.oldCount.toString().padStart(6)} New: ${result.newCount.toString().padStart(6)}`);
      
      if (!result.match) {
        allMatch = false;
        if (result.errors.length > 0) {
          result.errors.forEach((error) => console.log(`    - ${error}`));
        }
      }
    }
    
    console.log('─'.repeat(60));
    
    if (allMatch) {
      console.log('\n[Validation] ✓ All validations passed!');
      process.exit(0);
    } else {
      console.log('\n[Validation] ✗ Some validations failed. Please review the errors above.');
      process.exit(1);
    }
  } catch (error: any) {
    console.error('[Validation] Fatal error:', error);
    process.exit(1);
  } finally {
    await oldPrisma.$disconnect();
    await newPrisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { main as validateMigration };

