-- Optional scheduled-start trigger. When set, the bot's match-sweep
-- loop flips the season to isActive=true at this time and clears the
-- field. Editable/clearable freely until the sweep fires.

ALTER TABLE "Season" ADD COLUMN "scheduledStartAt" TIMESTAMP(3);
