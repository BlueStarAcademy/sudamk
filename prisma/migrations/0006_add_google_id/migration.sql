-- AlterTable
ALTER TABLE "UserCredential" ADD COLUMN IF NOT EXISTS "googleId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserCredential_googleId_key" ON "UserCredential"("googleId");
