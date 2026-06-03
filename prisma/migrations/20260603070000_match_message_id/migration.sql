-- Persist the Discord message ID for the public match embed so
-- ephemeral handlers (private ban menu) can edit the public message
-- cross-context via REST. Set on first send; never cleared.

ALTER TABLE "MatchSession" ADD COLUMN "matchMessageId" TEXT;
