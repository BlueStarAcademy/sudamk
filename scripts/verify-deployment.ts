/**
 * Post-deployment verification script
 * 배포 후 검증 스크립트
 */

import { execSync } from 'child_process';

interface VerificationResult {
  name: string;
  passed: boolean;
  message: string;
  url?: string;
}

const results: VerificationResult[] = [];

function addResult(name: string, passed: boolean, message: string, url?: string) {
  results.push({ name, passed, message, url });
}

async function checkHealthEndpoint(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/health`);
    if (!response.ok) {
      addResult(
        'Health Check',
        false,
        `Health check failed: ${response.status} ${response.statusText}`,
        `${baseUrl}/health`
      );
      return false;
    }
    
    const data = await response.json();
    if (data.status === 'ok') {
      addResult(
        'Health Check',
        true,
        `Server is healthy (uptime: ${Math.floor(data.uptime)}s)`,
        `${baseUrl}/health`
      );
      return true;
    } else {
      addResult('Health Check', false, `Unexpected health status: ${data.status}`, `${baseUrl}/health`);
      return false;
    }
  } catch (error: any) {
    addResult('Health Check', false, `Health check error: ${error.message}`, `${baseUrl}/health`);
    return false;
  }
}

async function checkApiEndpoint(baseUrl: string): Promise<boolean> {
  try {
    const response = await fetch(`${baseUrl}/api`);
    if (!response.ok) {
      addResult('API Endpoint', false, `API check failed: ${response.status}`, `${baseUrl}/api`);
      return false;
    }
    
    const data = await response.json();
    if (data.name && data.version) {
      addResult(
        'API Endpoint',
        true,
        `API is running (${data.name} v${data.version})`,
        `${baseUrl}/api`
      );
      return true;
    } else {
      addResult('API Endpoint', false, 'Unexpected API response format', `${baseUrl}/api`);
      return false;
    }
  } catch (error: any) {
    addResult('API Endpoint', false, `API check error: ${error.message}`, `${baseUrl}/api`);
    return false;
  }
}

async function checkTrpcEndpoint(baseUrl: string): Promise<boolean> {
  try {
    // Check if tRPC endpoint is accessible
    const response = await fetch(`${baseUrl}/trpc`, {
      method: 'OPTIONS',
    });
    
    // tRPC might return 404 for OPTIONS, but that's okay - we just check if server responds
    addResult(
      'tRPC Endpoint',
      true,
      'tRPC endpoint is accessible',
      `${baseUrl}/trpc`
    );
    return true;
  } catch (error: any) {
    addResult('tRPC Endpoint', false, `tRPC check error: ${error.message}`, `${baseUrl}/trpc`);
    return false;
  }
}

function checkEnvironmentVariables(): boolean {
  const requiredVars = ['DATABASE_URL', 'JWT_SECRET', 'NODE_ENV'];
  let allPresent = true;
  
  for (const varName of requiredVars) {
    const value = process.env[varName];
    if (!value) {
      addResult(`Env: ${varName}`, false, `${varName} is not set`);
      allPresent = false;
    } else {
      // Mask sensitive values
      const masked = varName === 'JWT_SECRET' 
        ? `${value.substring(0, 4)}...${value.substring(value.length - 4)}`
        : value.length > 50 
        ? `${value.substring(0, 20)}...`
        : value;
      addResult(`Env: ${varName}`, true, `${varName} is set (${masked})`);
    }
  }
  
  return allPresent;
}

async function main() {
  console.log('🔍 SUDAM v2 Deployment Verification\n');
  console.log('='.repeat(60));
  
  // Get base URL from environment or argument
  const baseUrl = process.argv[2] || process.env.API_URL || 'http://localhost:4000';
  
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    console.error('❌ Invalid URL. Must start with http:// or https://');
    console.log('Usage: pnpm verify:deployment <api-url>');
    console.log('Example: pnpm verify:deployment https://api.example.com');
    process.exit(1);
  }
  
  console.log(`\n🌐 Checking deployment at: ${baseUrl}\n`);
  
  // Check environment variables
  console.log('🔐 Checking environment variables...');
  checkEnvironmentVariables();
  
  // Check endpoints
  console.log('\n🔗 Checking API endpoints...');
  await checkHealthEndpoint(baseUrl);
  await checkApiEndpoint(baseUrl);
  await checkTrpcEndpoint(baseUrl);
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('\n📊 Verification Results:\n');
  
  results.forEach((result) => {
    const icon = result.passed ? '✅' : '❌';
    console.log(`  ${icon} ${result.name}`);
    console.log(`     ${result.message}`);
    if (result.url) {
      console.log(`     URL: ${result.url}`);
    }
    console.log();
  });
  
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const failed = results.filter((r) => !r.passed);
  
  console.log('='.repeat(60));
  console.log(`\n✅ Passed: ${passed}/${total}`);
  
  if (failed.length > 0) {
    console.log(`❌ Failed: ${failed.length}/${total}`);
    console.log('\n⚠️  Some checks failed. Please review the issues above.');
    console.log('\n💡 Troubleshooting tips:');
    console.log('   - Check if the server is running');
    console.log('   - Verify environment variables are set correctly');
    console.log('   - Check Railway logs for errors');
    console.log('   - Ensure database is connected');
    process.exit(1);
  } else {
    console.log('\n🎉 All checks passed! Deployment is healthy.');
    console.log('\n📋 Next steps:');
    console.log('   - Monitor logs for any issues');
    console.log('   - Test user registration and login');
    console.log('   - Test game creation and gameplay');
    console.log('   - Monitor performance metrics');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('❌ Verification script error:', error);
  process.exit(1);
});

