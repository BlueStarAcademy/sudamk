/**
 * Production preparation script
 * 프로덕션 배포 준비 스크립트
 */

import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const requiredEnvVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'NODE_ENV',
];

const optionalEnvVars = [
  'PORT',
  'ALLOWED_ORIGINS',
  'RAILWAY_ENVIRONMENT',
];

function checkEnvVar(name: string, required: boolean = true): boolean {
  const value = process.env[name];
  if (required && !value) {
    console.error(`❌ Required environment variable ${name} is not set`);
    return false;
  }
  if (value && name === 'JWT_SECRET' && value.length < 32) {
    console.error(`❌ JWT_SECRET must be at least 32 characters long`);
    return false;
  }
  if (value) {
    console.log(`✅ ${name} is set`);
  } else if (!required) {
    console.log(`⚠️  ${name} is not set (optional)`);
  }
  return true;
}

function checkBuildArtifacts(): boolean {
  console.log('\n📦 Checking build artifacts...');
  
  const apiDist = join(process.cwd(), 'apps/api/dist');
  const webNext = join(process.cwd(), 'apps/web/.next');
  
  let allExist = true;
  
  if (!existsSync(apiDist)) {
    console.error(`❌ API build artifacts not found at ${apiDist}`);
    console.log('   Run: cd apps/api && pnpm build');
    allExist = false;
  } else {
    console.log(`✅ API build artifacts found`);
  }
  
  if (!existsSync(webNext)) {
    console.error(`❌ Web build artifacts not found at ${webNext}`);
    console.log('   Run: cd apps/web && pnpm build');
    allExist = false;
  } else {
    console.log(`✅ Web build artifacts found`);
  }
  
  return allExist;
}

function checkDatabaseConnection(): boolean {
  console.log('\n🗄️  Checking database connection...');
  
  try {
    // Try to import Prisma client and check connection
    const { getPrismaClient } = require('@sudam/database');
    const prisma = getPrismaClient();
    
    // Check if Prisma client can be imported
    console.log('✅ Database client can be imported');
    
    // Note: Actual connection test would require async/await
    // This is a basic check - full connection test should be done separately
    console.log('⚠️  Full connection test requires database access');
    console.log('   Run: pnpm db:migrate (to apply migrations)');
    
    return true;
  } catch (error: any) {
    console.error(`❌ Database connection check failed: ${error.message}`);
    console.log('   Make sure DATABASE_URL is set correctly');
    return false;
  }
}

function checkMigrations(): boolean {
  console.log('\n📋 Checking database migrations...');
  
  try {
    const { execSync } = require('child_process');
    
    // Check if Prisma schema exists
    const schemaPath = join(process.cwd(), 'packages/database/schema.prisma');
    if (!existsSync(schemaPath)) {
      console.error('❌ Prisma schema not found');
      return false;
    }
    
    console.log('✅ Prisma schema found');
    console.log('⚠️  Run migrations before deployment: pnpm db:migrate');
    console.log('   Or use: pnpm db:push (for development/testing)');
    
    return true;
  } catch (error: any) {
    console.error(`❌ Migration check failed: ${error.message}`);
    return false;
  }
}

function runTests(): boolean {
  console.log('\n🧪 Running tests...');
  
  try {
    execSync('pnpm test', { stdio: 'inherit' });
    console.log('✅ All tests passed');
    return true;
  } catch (error) {
    console.error('❌ Tests failed');
    return false;
  }
}

function main() {
  console.log('🚀 SUDAM v2 Production Preparation\n');
  console.log('=' .repeat(50));
  
  let allChecksPassed = true;
  
  // Check environment variables
  console.log('\n🔐 Checking environment variables...');
  for (const envVar of requiredEnvVars) {
    if (!checkEnvVar(envVar, true)) {
      allChecksPassed = false;
    }
  }
  
  for (const envVar of optionalEnvVars) {
    checkEnvVar(envVar, false);
  }
  
  // Check build artifacts
  if (!checkBuildArtifacts()) {
    allChecksPassed = false;
  }
  
  // Check database connection
  if (!checkDatabaseConnection()) {
    allChecksPassed = false;
  }
  
  // Check migrations
  if (!checkMigrations()) {
    allChecksPassed = false;
  }
  
  // Run tests
  const runTestsFlag = process.argv.includes('--test');
  if (runTestsFlag) {
    if (!runTests()) {
      allChecksPassed = false;
    }
  } else {
    console.log('\n🧪 Skipping tests (use --test flag to run tests)');
  }
  
  console.log('\n' + '='.repeat(50));
  
  if (allChecksPassed) {
    console.log('\n✅ All checks passed! Ready for production deployment.');
    process.exit(0);
  } else {
    console.log('\n❌ Some checks failed. Please fix the issues above before deploying.');
    process.exit(1);
  }
}

main();

