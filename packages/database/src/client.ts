/**
 * Prisma client singleton
 */

import { PrismaClient } from '../generated';

// Prisma client singleton instance
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
    
    // Handle connection errors
    prisma.$on('error' as never, (e: any) => {
      console.error('[Prisma] Database error:', e);
    });
  }
  
  return prisma;
}

// Graceful shutdown
export async function disconnectPrisma() {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

// Auto-disconnect on process exit
if (typeof process !== 'undefined') {
  process.on('beforeExit', async () => {
    await disconnectPrisma();
  });
  
  process.on('SIGTERM', async () => {
    await disconnectPrisma();
  });
  
  process.on('SIGINT', async () => {
    await disconnectPrisma();
  });
}

