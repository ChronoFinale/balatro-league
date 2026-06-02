-- Snapshot of Player.rating (global rank) at end-of-season per division
-- member. Lets us reconstruct historical end-of-season global ranks even
-- after a later season's endSeason rewrites Player.rating. Nullable —
-- populated only for seasons whose endSeason has run after this column
-- exists. No backfill for already-ended seasons (their original ranks
-- are no longer recoverable).

ALTER TABLE "DivisionMember" ADD COLUMN "finalGlobalRank" INTEGER;
