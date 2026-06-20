-- Flag: are this season's division schedules locked (assigned matchups pre-created
-- as PENDING Match rows at activation)? Single source of truth for "fixed schedule
-- vs on-demand round-robin", replacing the leftover-0-0-PENDING heuristic. Existing
-- seasons start false (on-demand); set true by lockDivisionSchedules at activation.
-- Additive + safe.
ALTER TABLE "Season" ADD COLUMN "scheduleLocked" BOOLEAN NOT NULL DEFAULT false;
