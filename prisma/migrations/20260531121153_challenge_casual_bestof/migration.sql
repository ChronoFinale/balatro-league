-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "MatchSessionState" ADD VALUE 'GAME_3_CHOOSE_FIRST';
ALTER TYPE "MatchSessionState" ADD VALUE 'GAME_3_BAN';
ALTER TYPE "MatchSessionState" ADD VALUE 'GAME_3_PICK';
ALTER TYPE "MatchSessionState" ADD VALUE 'GAME_3_PLAYING';

-- AlterTable
ALTER TABLE "MatchSession" ADD COLUMN     "bestOf" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "game3" TEXT,
ADD COLUMN     "isCasual" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "divisionId" DROP NOT NULL;
