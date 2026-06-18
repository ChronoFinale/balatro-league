-- When the season-start announcement posted. The last division bootstrap job
-- fires it (after all League Player role assignments), claimed atomically here
-- so it posts exactly once.
ALTER TABLE "Season" ADD COLUMN "startAnnouncedAt" TIMESTAMP(3);
