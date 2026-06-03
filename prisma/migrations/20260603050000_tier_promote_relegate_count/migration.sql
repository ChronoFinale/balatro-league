-- Per-tier symmetric promote/relegate count. Drives the ↑/↓ markers
-- on /standings (top N promote up, bottom N relegate down). Defaults
-- to 1 to match the historical hardcoded behavior, so existing tiers
-- get the same visual treatment as before.

ALTER TABLE "Tier" ADD COLUMN "promoteRelegateCount" INTEGER NOT NULL DEFAULT 1;
