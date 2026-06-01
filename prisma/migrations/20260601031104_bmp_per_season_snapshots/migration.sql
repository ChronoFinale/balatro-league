-- AlterTable
ALTER TABLE "PlayerMmrSnapshot" ADD COLUMN     "bmpSeason" TEXT,
ADD COLUMN     "leaderboardRank" INTEGER,
ADD COLUMN     "losses" INTEGER,
ADD COLUMN     "peakMmr" INTEGER,
ADD COLUMN     "peakStreak" INTEGER,
ADD COLUMN     "wins" INTEGER;

-- CreateIndex
CREATE INDEX "PlayerMmrSnapshot_discordId_bmpSeason_capturedAt_idx" ON "PlayerMmrSnapshot"("discordId", "bmpSeason", "capturedAt");
