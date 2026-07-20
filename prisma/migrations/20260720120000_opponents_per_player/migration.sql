-- Replace the boolean roundRobin format flag with a per-player opponent count
-- (the graph degree). The scheduler clamps it to (divisionSize - 1), so a value
-- >= size-1 yields a full round-robin and a small division becomes round-robin
-- naturally.
ALTER TABLE "Division" ADD COLUMN "opponentsPerPlayer" INTEGER;

-- Backfill existing divisions so behaviour is preserved:
--   round-robin (true)  -> a high value that always clamps to (size-1) = everyone
--   4-opponent graph (false) -> 4
--   unset (null)        -> stays null (falls back to the season default)
UPDATE "Division" SET "opponentsPerPlayer" = 999 WHERE "roundRobin" = true;
UPDATE "Division" SET "opponentsPerPlayer" = 4 WHERE "roundRobin" = false;

ALTER TABLE "Division" DROP COLUMN "roundRobin";
