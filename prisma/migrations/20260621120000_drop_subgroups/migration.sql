-- Remove the sub-group ("pod") model entirely. The league is moving to a
-- graph-based schedule (each player is assigned a fixed set of opponents),
-- so pods are gone: standings + promotion already run division-wide, and the
-- schedule is stored as the assigned Match rows, not a group index.
--
-- Safe: the active season never used these (all assignmentGroup were NULL,
-- no sub-group threads created), and the project is pre-launch with no
-- back-compat requirement.
ALTER TABLE "DivisionMember" DROP COLUMN IF EXISTS "assignmentGroup";
ALTER TABLE "Division" DROP COLUMN IF EXISTS "subGroupThreadIds";
ALTER TABLE "Season" DROP COLUMN IF EXISTS "subGroupSize";
