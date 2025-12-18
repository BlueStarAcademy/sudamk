#!/usr/bin/env tsx
/**
 * Integration test runner
 * 통합 테스트 실행 스크립트
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';

console.log('[Test] Running integration tests...\n');

try {
  // Check if test database is configured
  if (!process.env.DATABASE_URL && !process.env.TEST_DATABASE_URL) {
    console.warn('[Test] WARNING: DATABASE_URL or TEST_DATABASE_URL not set');
    console.warn('[Test] Tests may fail without a database connection');
  }

  // Run API tests
  console.log('[Test] Running API integration tests...');
  execSync('cd apps/api && pnpm test', { stdio: 'inherit' });

  console.log('\n[Test] ✓ All integration tests passed!');
} catch (error) {
  console.error('\n[Test] ✗ Integration tests failed');
  process.exit(1);
}

