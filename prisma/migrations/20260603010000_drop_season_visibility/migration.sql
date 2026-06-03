-- Drop the visibility concept entirely. With a dedicated dev stack the
-- "internal test season on prod" use case is gone; admin sees every
-- season always, players see active + ended seasons via isActive /
-- endedAt filters.
DROP INDEX IF EXISTS "Season_isActive_visibility_idx";
ALTER TABLE "Season" DROP COLUMN "visibility";
DROP TYPE "SeasonVisibility";
CREATE INDEX IF NOT EXISTS "Season_isActive_idx" ON "Season"("isActive");
