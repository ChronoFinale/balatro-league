-- Move mutual-consent cancel votes from per-game GameState to the
-- session level so cancel can be triggered in any non-terminal phase,
-- not just BAN. Mirrors the existing pause-vote pattern.

ALTER TABLE "MatchSession" ADD COLUMN "cancelInitiatorPlayerId" TEXT;
ALTER TABLE "MatchSession" ADD COLUMN "cancelInitiatedAt" TIMESTAMP(3);
