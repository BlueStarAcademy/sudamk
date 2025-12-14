/**
 * Test setup
 * 테스트 환경 설정
 */

import { beforeAll, afterAll } from 'vitest';
import { getPrismaClient } from '@sudam/database';

const prisma = getPrismaClient();

beforeAll(async () => {
  // Test database setup if needed
  console.log('[Test] Setting up test environment...');
});

afterAll(async () => {
  // Cleanup
  await prisma.$disconnect();
  console.log('[Test] Test environment cleaned up');
});

