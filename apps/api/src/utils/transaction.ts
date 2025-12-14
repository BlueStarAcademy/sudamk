/**
 * Transaction utilities
 * 트랜잭션 관리 유틸리티
 */

import { getPrismaClient } from '@sudam/database';
import type { Prisma } from '@prisma/client';

/**
 * Execute a transaction with automatic rollback on error
 */
export async function executeTransaction<T>(
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T> {
  const prisma = getPrismaClient();
  
  try {
    return await prisma.$transaction(callback, {
      maxWait: options?.maxWait ?? 5000, // 5 seconds
      timeout: options?.timeout ?? 10000, // 10 seconds
      isolationLevel: options?.isolationLevel,
    });
  } catch (error) {
    // Log transaction error
    console.error('[Transaction] Transaction failed:', error);
    throw error;
  }
}

/**
 * Execute multiple operations in a transaction
 */
export async function executeBatchTransaction<T>(
  operations: Array<(tx: Prisma.TransactionClient) => Promise<T>>,
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
): Promise<T[]> {
  return executeTransaction(
    async (tx) => {
      return Promise.all(operations.map((op) => op(tx)));
    },
    options
  );
}

/**
 * Transaction decorator for async functions
 * Usage: @withTransaction
 */
export function withTransaction(
  options?: {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: Prisma.TransactionIsolationLevel;
  }
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const prisma = getPrismaClient();
      
      return prisma.$transaction(
        async (tx) => {
          // Replace prisma client with transaction client in context
          const originalPrisma = (this as any).prisma;
          (this as any).prisma = tx;
          
          try {
            return await originalMethod.apply(this, args);
          } finally {
            (this as any).prisma = originalPrisma;
          }
        },
        {
          maxWait: options?.maxWait ?? 5000,
          timeout: options?.timeout ?? 10000,
          isolationLevel: options?.isolationLevel,
        }
      );
    };

    return descriptor;
  };
}

