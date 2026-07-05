-- League ban on Player: blocks signing up, being added to a round, opting into
-- reminders, being placed into a division, and starting/queuing matches. Set and
-- cleared by an admin (bannedBy = admin Discord id, bannedReason = admin note).
-- Null bannedAt = not banned.

-- AlterTable
ALTER TABLE "Player" ADD COLUMN "bannedAt" TIMESTAMP(3);
ALTER TABLE "Player" ADD COLUMN "bannedReason" TEXT;
ALTER TABLE "Player" ADD COLUMN "bannedBy" TEXT;

-- CreateIndex
CREATE INDEX "Player_bannedAt_idx" ON "Player"("bannedAt");
