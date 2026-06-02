-- Pairing: profile-history queries do OR(playerAId, playerBId); the
-- unique constraint covers playerAId only.
CREATE INDEX "Pairing_playerBId_idx" ON "Pairing"("playerBId");

-- MatchSession: idle-session sweep scans state-not-in-terminal +
-- updatedAt < cutoff every minute.
CREATE INDEX "MatchSession_state_updatedAt_idx" ON "MatchSession"("state", "updatedAt");
