-- Per-member seed snapshot: Player.rating value at the moment the
-- season was built. Combined with finalGlobalRank this gives the full
-- "started at #N, ended at #M" arc per (season, player).

ALTER TABLE "DivisionMember" ADD COLUMN "seedRank" INTEGER;
