// 데이터베이스 연결 테스트 스크립트
import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.ts';

const prisma = new PrismaClient();

async function testConnection() {
  console.log('🔍 데이터베이스 연결 테스트 시작...\n');
  
  // DATABASE_URL 확인
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL이 설정되지 않았습니다!');
    console.error('   .env 파일에 DATABASE_URL을 설정하세요.');
    process.exit(1);
  }
  
  // URL 정보 출력 (비밀번호는 마스킹)
  const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
  console.log('📋 DATABASE_URL:', maskedUrl);
  console.log('   호스트:', dbUrl.match(/@([^:]+):/)?.[1] || 'N/A');
  console.log('   포트:', dbUrl.match(/:(\d+)\//)?.[1] || 'N/A');
  console.log('   데이터베이스:', dbUrl.match(/\/([^?]+)/)?.[1] || 'N/A');
  console.log('   SSL 모드:', dbUrl.includes('sslmode') ? dbUrl.match(/sslmode=([^&]+)/)?.[1] : 'not specified');
  console.log('');
  
  // 연결 테스트
  console.log('🔄 데이터베이스 연결 시도...');
  try {
    const startTime = Date.now();
    await Promise.race([
      prisma.$queryRaw`SELECT 1 as test`,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout after 10 seconds')), 10000)
      )
    ]);
    const duration = Date.now() - startTime;
    
    console.log('✅ 데이터베이스 연결 성공!');
    console.log(`   응답 시간: ${duration}ms\n`);
    
    // 추가 정보 조회
    try {
      const result = await prisma.$queryRaw`SELECT version() as version`;
      console.log('📊 PostgreSQL 버전:', result[0]?.version || 'N/A');
    } catch (e) {
      console.warn('⚠️  버전 정보 조회 실패:', e.message);
    }
    
    // 테이블 목록 조회
    try {
      const tables = await prisma.$queryRaw`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
      `;
      console.log(`\n📋 테이블 개수: ${tables.length}개`);
      if (tables.length > 0) {
        console.log('   테이블 목록:', tables.slice(0, 5).map(t => t.table_name).join(', '));
        if (tables.length > 5) {
          console.log(`   ... 외 ${tables.length - 5}개`);
        }
      }
    } catch (e) {
      console.warn('⚠️  테이블 목록 조회 실패:', e.message);
    }
    
    console.log('\n✅ 모든 테스트 통과!');
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ 데이터베이스 연결 실패!');
    console.error('   에러:', error.message);
    console.error('   코드:', error.code || 'N/A');
    
    // 에러 타입별 해결 방법 제시
    if (error.message.includes("Can't reach database server")) {
      console.error('\n🔧 해결 방법:');
      console.error('   1. Railway 대시보드에서 Postgres 서비스가 실행 중인지 확인');
      console.error('   2. 네트워크 연결 확인');
      console.error('   3. 방화벽 설정 확인');
    } else if (error.message.includes('password authentication')) {
      console.error('\n🔧 해결 방법:');
      console.error('   1. DATABASE_URL의 비밀번호가 올바른지 확인');
      console.error('   2. Railway 대시보드에서 비밀번호 확인');
    } else if (error.message.includes('timeout')) {
      console.error('\n🔧 해결 방법:');
      console.error('   1. 네트워크 연결이 느린지 확인');
      console.error('   2. Railway 데이터베이스가 과부하 상태인지 확인');
      console.error('   3. 로컬 PostgreSQL 사용 고려');
    } else if (error.message.includes('SSL')) {
      console.error('\n🔧 해결 방법:');
      console.error('   DATABASE_URL에 ?sslmode=require 추가');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testConnection();
