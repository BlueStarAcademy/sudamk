/**
 * Quick deployment readiness check
 * 빠른 배포 준비 상태 확인 스크립트
 */

import { existsSync } from 'fs';
import { join } from 'path';

interface CheckResult {
  name: string;
  passed: boolean;
  message: string;
}

const checks: CheckResult[] = [];

function addCheck(name: string, passed: boolean, message: string) {
  checks.push({ name, passed, message });
}

function checkFile(filePath: string, description: string): boolean {
  const fullPath = join(process.cwd(), filePath);
  const exists = existsSync(fullPath);
  addCheck(
    description,
    exists,
    exists ? `✅ Found: ${filePath}` : `❌ Missing: ${filePath}`
  );
  return exists;
}

function checkEnvVar(name: string, required: boolean = false): boolean {
  const value = process.env[name];
  const passed = required ? !!value : true;
  const message = value
    ? `✅ ${name} is set`
    : required
    ? `❌ ${name} is required but not set`
    : `⚠️  ${name} is not set (optional)`;
  addCheck(name, passed, message);
  return passed;
}

console.log('🚀 SUDAM v2 Deployment Readiness Check\n');
console.log('='.repeat(60));

// Check essential files
console.log('\n📁 Checking essential files...');
checkFile('package.json', 'Root package.json');
checkFile('apps/api/package.json', 'API package.json');
checkFile('apps/web/package.json', 'Web package.json');
checkFile('packages/database/schema.prisma', 'Prisma schema');
checkFile('railway.json', 'Railway config');
checkFile('.github/workflows/ci.yml', 'CI workflow');
checkFile('.github/workflows/deploy.yml', 'Deploy workflow');

// Check environment variables (for production)
console.log('\n🔐 Checking environment variables...');
if (process.env.NODE_ENV === 'production') {
  console.log('   (Production mode - checking required vars)');
  checkEnvVar('DATABASE_URL', true);
  checkEnvVar('JWT_SECRET', true);
  checkEnvVar('NODE_ENV', true);
  checkEnvVar('PORT', false);
  checkEnvVar('ALLOWED_ORIGINS', false);
  checkEnvVar('NEXT_PUBLIC_API_URL', false); // For frontend
} else {
  console.log('   (Development mode - skipping env var checks)');
  addCheck('Environment', true, '⚠️  NODE_ENV is not production (expected in dev)');
}

// Check documentation
console.log('\n📚 Checking documentation...');
checkFile('docs/RAILWAY_DEPLOYMENT.md', 'Railway deployment guide');
checkFile('docs/DEPLOYMENT_CHECKLIST.md', 'Deployment checklist');
checkFile('docs/PRODUCTION_README.md', 'Production README');
checkFile('README.md', 'Main README');

// Summary
console.log('\n' + '='.repeat(60));
console.log('\n📊 Summary:\n');

const passed = checks.filter((c) => c.passed).length;
const total = checks.length;
const failed = checks.filter((c) => !c.passed);

checks.forEach((check) => {
  console.log(`  ${check.message}`);
});

console.log(`\n✅ Passed: ${passed}/${total}`);
if (failed.length > 0) {
  console.log(`❌ Failed: ${failed.length}/${total}`);
  console.log('\n⚠️  Please fix the issues above before deploying.');
  process.exit(1);
} else {
  console.log('\n🎉 All checks passed! Ready for deployment.');
  console.log('\n📋 Next steps:');
  console.log('   1. Set environment variables in Railway');
  console.log('   2. Run: pnpm db:migrate (if needed)');
  console.log('   3. Deploy to Railway');
  console.log('   4. Check: https://your-domain.railway.app/health');
  process.exit(0);
}

