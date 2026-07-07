"use client";

// Persistent, role-aware sub-nav for every /seasons/[name]/* page. The layout
// (server) resolves role + builds the tab list; this component only renders it
// and highlights the active tab via the current pathname.
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SeasonNavTab {
  href: string;
  label: string;
  // Pick'em / Fantasy — the fun draw for players — get a subtle accent even
  // when inactive so they stand out from the ops-flavored tabs.
  emphasis?: boolean;
}

export interface SeasonNavProps {
  seasonName: string;
  tabs: SeasonNavTab[];
}

// Trailing-slash-insensitive equality. Deliberately NOT a startsWith/prefix
// match: every subpage path starts with the season root path, so a prefix
// match would leave "Overview" permanently active.
const normalize = (path: string): string => path.replace(/\/+$/, "") || "/";

export function SeasonNav({ seasonName, tabs }: SeasonNavProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={`${seasonName} season navigation`}
      className="flex flex-wrap items-center gap-2 overflow-x-auto"
      style={{ maxWidth: "100%", WebkitOverflowScrolling: "touch" }}
    >
      {tabs.map((tab) => {
        const active = normalize(pathname) === normalize(tab.href);
        const color = active ? "var(--accent)" : tab.emphasis ? "var(--accent-2)" : "var(--muted)";
        const borderColor = active
          ? "var(--accent)"
          : tab.emphasis
            ? "color-mix(in srgb, var(--accent-2) 45%, var(--border))"
            : "var(--border)";
        const background = active ? "color-mix(in srgb, var(--accent) 14%, var(--surface-2))" : "var(--surface-2)";
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className="pill hover:no-underline"
            style={{ background, border: `1px solid ${borderColor}`, color, fontWeight: active ? 700 : 600 }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
