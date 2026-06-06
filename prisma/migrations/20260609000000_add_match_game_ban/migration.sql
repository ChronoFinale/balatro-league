-- CreateEnum
CREATE TYPE "MatchFormat" AS ENUM ('LEAGUE_BO2', 'SHOOTOUT_BO1');

-- CreateTable
CREATE TABLE "Match" (
    "id" TEXT NOT NULL,
    "divisionId" TEXT NOT NULL,
    "playerAId" TEXT NOT NULL,
    "playerBId" TEXT NOT NULL,
    "format" "MatchFormat" NOT NULL DEFAULT 'LEAGUE_BO2',
    "gamesWonA" INTEGER NOT NULL DEFAULT 0,
    "gamesWonB" INTEGER NOT NULL DEFAULT 0,
    "winnerId" TEXT,
    "status" "PairingStatus" NOT NULL DEFAULT 'PENDING',
    "reporterId" TEXT,
    "reportedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "adminOverrideBy" TEXT,
    "adminOverrideReason" TEXT,
    "reportChannelId" TEXT,
    "reportMessageId" TEXT,
    "disputedById" TEXT,
    "disputeProposedGamesWonA" INTEGER,
    "disputeProposedGamesWonB" INTEGER,
    "disputeReason" TEXT,
    "disputedAt" TIMESTAMP(3),
    "disputeThreadId" TEXT,
    "hadDc" BOOLEAN NOT NULL DEFAULT false,
    "reportedDeck" TEXT,
    "reportedStake" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "num" INTEGER NOT NULL,
    "firstPlayerId" TEXT NOT NULL,
    "winnerId" TEXT,
    "deck" TEXT NOT NULL,
    "stake" TEXT NOT NULL,
    "dcByPlayerId" TEXT,
    "pickedRandomly" BOOLEAN NOT NULL DEFAULT false,
    "firstBannedRandomly" BOOLEAN NOT NULL DEFAULT false,
    "otherBannedRandomly" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ban" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "deck" TEXT NOT NULL,
    "stake" TEXT NOT NULL,

    CONSTRAINT "Ban_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Match_divisionId_status_idx" ON "Match"("divisionId", "status");

-- CreateIndex
CREATE INDEX "Match_playerBId_idx" ON "Match"("playerBId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_divisionId_playerAId_playerBId_format_key" ON "Match"("divisionId", "playerAId", "playerBId", "format");

-- CreateIndex
CREATE INDEX "Game_matchId_idx" ON "Game"("matchId");

-- CreateIndex
CREATE INDEX "Game_deck_idx" ON "Game"("deck");

-- CreateIndex
CREATE INDEX "Game_stake_idx" ON "Game"("stake");

-- CreateIndex
CREATE UNIQUE INDEX "Game_matchId_num_key" ON "Game"("matchId", "num");

-- CreateIndex
CREATE INDEX "Ban_gameId_idx" ON "Ban"("gameId");

-- CreateIndex
CREATE INDEX "Ban_deck_idx" ON "Ban"("deck");

-- CreateIndex
CREATE INDEX "Ban_stake_idx" ON "Ban"("stake");

-- CreateIndex
CREATE UNIQUE INDEX "Ban_gameId_ordinal_key" ON "Ban"("gameId", "ordinal");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_disputedById_fkey" FOREIGN KEY ("disputedById") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ban" ADD CONSTRAINT "Ban_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

