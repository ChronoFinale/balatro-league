-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "forfeit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "forfeitReason" TEXT;

