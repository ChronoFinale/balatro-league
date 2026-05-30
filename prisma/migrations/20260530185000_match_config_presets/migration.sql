-- Create the new MatchConfigPreset table
CREATE TABLE "MatchConfigPreset" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "decks" TEXT[],
    "stakes" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchConfigPreset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchConfigPreset_name_key" ON "MatchConfigPreset"("name");

-- Add the FK column on Season
ALTER TABLE "Season" ADD COLUMN "matchConfigPresetId" TEXT;

-- Data preservation: roll existing AllowedDeck/AllowedStake rows into a "Default" preset
-- so admins don't lose their seeded whitelist on this migration.
INSERT INTO "MatchConfigPreset" ("id", "name", "decks", "stakes", "createdAt", "updatedAt")
SELECT
    'default-preset-migrated',
    'Default',
    COALESCE((SELECT array_agg("name" ORDER BY "name") FROM "AllowedDeck"), ARRAY[]::TEXT[]),
    COALESCE((SELECT array_agg("name" ORDER BY "name") FROM "AllowedStake"), ARRAY[]::TEXT[]),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "AllowedDeck") OR EXISTS (SELECT 1 FROM "AllowedStake");

-- Drop the now-replaced legacy tables
DROP TABLE "AllowedDeck";
DROP TABLE "AllowedStake";

-- Add the FK constraint AFTER tables are in their final shape
ALTER TABLE "Season" ADD CONSTRAINT "Season_matchConfigPresetId_fkey"
    FOREIGN KEY ("matchConfigPresetId") REFERENCES "MatchConfigPreset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
