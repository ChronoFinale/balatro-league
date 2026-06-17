-- Player privacy fields.
-- showUsername: subject-side opt-out for the @username display. Default true
--   keeps current behavior (shown to verified server members); false hides it
--   everywhere, AND'd with the existing viewer-side gate.
ALTER TABLE "Player" ADD COLUMN "showUsername" BOOLEAN NOT NULL DEFAULT true;
-- timezone: IANA zone (e.g. "America/New_York") the player opted into sharing.
--   Null = not shared. Set on the website (auto-detected from the browser) or
--   via /timezone in Discord; cleared on opt-out. Zone only, never location.
ALTER TABLE "Player" ADD COLUMN "timezone" TEXT;
