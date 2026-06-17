-- Sub-group size, distinct from targetGroupSize (the division size). Used when
-- an admin generates sub-groups: each division splits into balanced groups of
-- this size; you round-robin within yours. Default 5 -> 4 matches per player.
ALTER TABLE "Season" ADD COLUMN "subGroupSize" INTEGER NOT NULL DEFAULT 5;
