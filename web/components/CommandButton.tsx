"use client";

// Clickable affordance for the ⌘K command palette — fires the custom event the
// CommandPalette listens for. Gives mobile/mouse users a way in (and advertises
// the keyboard shortcut). Icon-only on phones; full label + ⌘K hint on sm+.

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

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
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={() => window.dispatchEvent(new Event("command:toggle"))}
      title="Search / jump to a page (Ctrl/⌘ K)"
      aria-label="Search"
      className="gap-1.5 border-border text-[var(--muted)] hover:text-foreground"
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Search</span>
      {hint && (
        <kbd className="hidden rounded bg-[var(--bg)] px-1 text-[10px] leading-none sm:inline-flex">{hint}</kbd>
      )}
    </Button>
  );
}
