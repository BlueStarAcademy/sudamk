// Railway 데이터베이스가 시작될 때까지 대기하는 스크립트
import 'dotenv/config';
import { PrismaClient } from './generated/prisma/client.ts';

const prisma = new PrismaClient();

async function waitForDatabase(maxAttempts = 30, delayMs = 5000) {
  console.log('⏳ Railway 데이터베이스가 시작될 때까지 대기 중...\n');
  console.log(`   최대 시도 횟수: ${maxAttempts}회`);
  console.log(`   재시도 간격: ${delayMs / 1000}초\n`);
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`🔄 연결 시도 ${attempt}/${maxAttempts}...`);
      
      const startTime = Date.now();
      await Promise.race([
        prisma.$queryRaw`SELECT 1 as test`,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 10000)
        )
      ]);
      const duration = Date.now() - startTime;
      
      console.log(`\n✅ 데이터베이스 연결 성공!`);
      console.log(`   응답 시간: ${duration}ms`);
      console.log(`   시도 횟수: ${attempt}회\n`);
      
      // 추가 확인
      try {
        const version = await prisma.$queryRaw`SELECT version() as version`;
        console.log('📊 PostgreSQL 버전:', version[0]?.version?.split(' ')[0] || 'N/A');
      } catch (e) {
        // 버전 조회 실패는 무시
      }
      
      console.log('\n✅ 데이터베이스가 준비되었습니다!');
      console.log('   이제 서버를 시작할 수 있습니다: npm start\n');
      
      await prisma.$disconnect();
      process.exit(0);
      
    } catch (error) {
      const isConnectionError = 
        error.message?.includes("Can't reach database server") ||
        error.message?.includes('timeout') ||
        error.message?.includes('Connection timeout') ||
        error.code === 'P1001';
      
      if (isConnectionError) {
        if (attempt < maxAttempts) {
          console.log(`   ❌ 연결 실패: ${error.message}`);
          console.log(`   ⏳ ${delayMs / 1000}초 후 재시도...\n`);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          console.error(`\n❌ 최대 시도 횟수(${maxAttempts}회)에 도달했습니다.`);
          console.error('   Railway 대시보드에서 데이터베이스 상태를 확인하세요.');
          console.error('   또는 로컬 PostgreSQL을 사용하는 것을 고려하세요.\n');
          await prisma.$disconnect();
          process.exit(1);
        }
      } else {
        // 다른 종류의 에러 (인증 실패 등)
        console.error(`\n❌ 예상치 못한 에러: ${error.message}`);
        await prisma.$disconnect();
        process.exit(1);
      }
    }
  }
}

waitForDatabase();
