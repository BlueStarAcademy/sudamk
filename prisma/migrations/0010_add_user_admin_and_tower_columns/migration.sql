-- Columns that existed in schema.prisma / production (db push) but were missing from migrate history.
-- Fresh `prisma migrate deploy` (e.g. CI e2e) failed initializeDatabase/listUsers with:
--   The column `User.isAdmin` does not exist in the current database.

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "towerFloor" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastTowerClearTime" BIGINT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlyTowerFloor" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "User_towerFloor_idx" ON "User"("towerFloor");
CREATE INDEX IF NOT EXISTS "User_towerFloor_lastTowerClearTime_idx" ON "User"("towerFloor", "lastTowerClearTime");
