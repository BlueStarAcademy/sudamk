/**
 * JWT Secret Generator
 * JWT_SECRET 생성 스크립트
 */

import { randomBytes } from 'crypto';

function generateJWTSecret(length: number = 64): string {
  // 랜덤 바이트 생성 후 base64 인코딩
  const secret = randomBytes(length).toString('base64');
  return secret;
}

function main() {
  const length = process.argv[2] ? parseInt(process.argv[2], 10) : 64;
  
  if (length < 32) {
    console.error('❌ JWT_SECRET은 최소 32자 이상이어야 합니다.');
    process.exit(1);
  }
  
  const secret = generateJWTSecret(length);
  
  console.log('\n🔐 JWT_SECRET 생성 완료\n');
  console.log('='.repeat(60));
  console.log(secret);
  console.log('='.repeat(60));
  console.log(`\n📏 길이: ${secret.length}자`);
  console.log('\n💡 사용 방법:');
  console.log('   Railway → Variables → JWT_SECRET = (위의 값)');
  console.log('   또는 .env 파일에 추가:');
  console.log(`   JWT_SECRET=${secret}`);
  console.log('\n⚠️  주의: 이 값을 안전하게 보관하세요!');
  console.log('   - GitHub에 커밋하지 마세요');
  console.log('   - 환경 변수로만 사용하세요');
  console.log('   - 분실 시 재생성 필요 (기존 토큰 무효화)\n');
}

main();

