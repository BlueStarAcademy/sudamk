-- 도전의 탑 월간 최고 층수 컬럼 추가
-- Supabase SQL Editor에서 실행할 명령어

-- User 테이블에 monthlyTowerFloor 컬럼 추가
ALTER TABLE "User" 
ADD COLUMN IF NOT EXISTS "monthlyTowerFloor" INTEGER NOT NULL DEFAULT 0;

-- 기존 사용자들의 monthlyTowerFloor를 0으로 초기화 (이미 기본값이 0이지만 명시적으로 설정)
UPDATE "User" 
SET "monthlyTowerFloor" = 0 
WHERE "monthlyTowerFloor" IS NULL;

-- 컬럼이 NULL이 될 수 없도록 제약 조건 확인 (기본값이 있으므로 이미 NOT NULL)
-- 필요시 인덱스 추가 (선택사항)
-- CREATE INDEX IF NOT EXISTS "User_monthlyTowerFloor_idx" ON "User"("monthlyTowerFloor");

