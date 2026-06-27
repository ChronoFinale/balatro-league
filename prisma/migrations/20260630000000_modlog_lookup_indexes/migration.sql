-- Indexes for the moderation-capture per-message thread lookup (mod-log
-- resolveThread). Without these, every chat message in an untracked thread
-- full-scans Match (and SupportTicket) — a real source of DB load / lag.

-- CreateIndex
CREATE INDEX "Match_disputeThreadId_idx" ON "Match"("disputeThreadId");

-- CreateIndex
CREATE INDEX "SupportTicket_threadId_idx" ON "SupportTicket"("threadId");
