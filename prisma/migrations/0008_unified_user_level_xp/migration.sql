-- 통합 유저 레벨/경험치: 기존 전략 트랙을 기본으로 복사한 뒤 구 컬럼 제거.
-- 놀이 트랙 누적은 `status.serializedUser` 스냅샷에서 복구(첫 로드 시 userAdapter).

ALTER TABLE "User" ADD COLUMN "userLevel" INTEGER;
ALTER TABLE "User" ADD COLUMN "userXp" INTEGER;

UPDATE "User" SET "userLevel" = COALESCE("strategyLevel", 1), "userXp" = COALESCE("strategyXp", 0)
WHERE "userLevel" IS NULL;

ALTER TABLE "User" ALTER COLUMN "userLevel" SET DEFAULT 1;
ALTER TABLE "User" ALTER COLUMN "userLevel" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "userXp" SET DEFAULT 0;
ALTER TABLE "User" ALTER COLUMN "userXp" SET NOT NULL;

ALTER TABLE "User" DROP COLUMN "strategyLevel";
ALTER TABLE "User" DROP COLUMN "strategyXp";
ALTER TABLE "User" DROP COLUMN "playfulLevel";
ALTER TABLE "User" DROP COLUMN "playfulXp";
