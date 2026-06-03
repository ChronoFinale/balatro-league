-- Drop the soft "target end" deadline field. Season ends when admin
-- clicks End season; the planning-marker field added confusion (looked
-- enforce-able when it wasn't) without adding value.

ALTER TABLE "Season" DROP COLUMN "deadline";
