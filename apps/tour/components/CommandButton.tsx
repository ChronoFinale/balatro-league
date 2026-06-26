"use client";

// Clickable affordance for the ⌘K command palette — fires the custom event the
// CommandPalette listens for. Gives mobile/mouse users a way in (and advertises
// the keyboard shortcut). Icon-only on phones; full label + ⌘K hint on sm+.

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

export function CommandButton() {
  // ⌘ is a Mac key; everywhere else the shortcut is Ctrl. Detect client-side
  // (null until mounted, so server + first client render match — no hydration
  // mismatch — then the correct hint fills in).
  const [isMac, setIsMac] = useState<boolean | null>(null);
  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad|iPod/i.test(navigator.platform) || /Mac OS X/i.test(navigator.userAgent));
  }, []);
  const hint = isMac === null ? null : isMac ? "⌘K" : "Ctrl K";

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("command:toggle"))}
      title="Search / jump to a page (Ctrl/⌘ K)"
      aria-label="Search"
      className="flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Search</span>
      {hint && (
        <kbd className="hidden rounded bg-[var(--bg)] px-1 text-[10px] leading-none sm:inline-flex">{hint}</kbd>
      )}
    </button>
  );
}
