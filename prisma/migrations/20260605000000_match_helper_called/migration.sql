-- Track the first time a helper is summoned for a match so the Call
-- helper button can't re-ping the helper role for the same match.
ALTER TABLE "MatchSession" ADD COLUMN "helperCalledAt" TIMESTAMP(3);
