-- Sorted recent-match lists (division page, /admin/results) filter by division
-- (+ status) and order by confirmedAt. Fold confirmedAt into the existing
-- (divisionId, status) index so the order comes from the index — no separate
-- sort over the division's matches.
DROP INDEX "Match_divisionId_status_idx";
CREATE INDEX "Match_divisionId_status_confirmedAt_idx" ON "Match"("divisionId", "status", "confirmedAt");

-- Find rare-status matches (e.g. DISPUTED, for /admin/disputes) without
-- scanning every match in the table.
CREATE INDEX "Match_status_format_idx" ON "Match"("status", "format");
