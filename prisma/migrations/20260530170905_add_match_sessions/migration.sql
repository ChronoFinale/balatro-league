-- CreateEnum
CREATE TYPE "MatchSessionState" AS ENUM ('WAITING_ACCEPT', 'GAME_1_BAN', 'GAME_1_PICK', 'GAME_1_PLAYING', 'GAME_2_CHOOSE_FIRST', 'GAME_2_BAN', 'GAME_2_PICK', 'GAME_2_PLAYING', 'COMPLETE', 'CANCELLED');

-- CreateTable
CREATE TABLE "AllowedDeck" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AllowedDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllowedStake" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "AllowedStake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchSession" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "state" "MatchSessionState" NOT NULL DEFAULT 'WAITING_ACCEPT',
    "threadId" TEXT,
    "channelId" TEXT,
    "pool" TEXT,
    "game1" TEXT,
    "game2" TEXT,
    "pairingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "MatchSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AllowedDeck_name_key" ON "AllowedDeck"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AllowedStake_name_key" ON "AllowedStake"("name");

-- CreateIndex
CREATE INDEX "MatchSession_state_idx" ON "MatchSession"("state");

-- CreateIndex
CREATE INDEX "MatchSession_threadId_idx" ON "MatchSession"("threadId");
