-- Flag: has Elowen applied this match's result to player MMR yet? The match-sweep
-- picks up confirmed matches where this is false. Existing confirmed matches
-- start false; the first sweep applies the backlog (or use the /admin/mmr
-- recompute to seed from scratch). Additive + safe.
ALTER TABLE "Match" ADD COLUMN "mmrApplied" BOOLEAN NOT NULL DEFAULT false;
