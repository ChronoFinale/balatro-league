"use client";

// ⌘K / Ctrl+K command palette, mounted globally in the root layout. Jumps to any
// nav page, player, team-season, or season. The search index is fetched lazily
// the first time the palette opens (cheap, ids + names only) and filtered
// client-side by cmdk.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Users, Shield, Trophy, BarChart3, ScrollText, Settings } from "lucide-react";
import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import type { SearchIndex } from "@/lib/search";

const PAGES = [
  { label: "Seasons", href: "/", icon: CalendarDays },
  { label: "Players", href: "/players", icon: Users },
  { label: "Teams", href: "/teams", icon: Shield },
  { label: "Stats", href: "/stats", icon: BarChart3 },
  { label: "Hall of Fame", href: "/hall-of-fame", icon: Trophy },
  { label: "Rules", href: "/rules", icon: ScrollText },
  { label: "Admin", href: "/admin", icon: Settings },
];

const EMPTY: SearchIndex = { players: [], teams: [], seasons: [] };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState<SearchIndex>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    fetch("/api/search")
      .then((r) => r.json())
      .then((d: SearchIndex) => setIndex({ players: d.players ?? [], teams: d.teams ?? [], seasons: d.seasons ?? [] }))
      .catch(() => {});
  }, [open, loaded]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onToggle = () => setOpen((o) => !o); // fired by the nav Search button
    document.addEventListener("keydown", onKey);
    window.addEventListener("command:toggle", onToggle);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("command:toggle", onToggle);
    };
  }, []);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Jump to" description="Search players, teams, and seasons">
      <Command>
        <CommandInput placeholder="Jump to a player, team, or season…" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Pages">
            {PAGES.map((p) => {
              const Icon = p.icon;
              return (
                <CommandItem key={p.href} value={`page ${p.label}`} onSelect={() => go(p.href)}>
                  <Icon /> {p.label}
                </CommandItem>
              );
            })}
          </CommandGroup>
          {index.seasons.length > 0 && (
            <CommandGroup heading="Seasons">
              {index.seasons.map((s) => (
                <CommandItem
                  key={s.name}
                  value={`season ${s.name}`}
                  onSelect={() => go(`/seasons/${encodeURIComponent(s.name)}`)}
                >
                  <CalendarDays /> {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {index.teams.length > 0 && (
            <CommandGroup heading="Teams">
              {index.teams.map((t) => (
                <CommandItem key={t.id} value={`team ${t.name} ${t.season}`} onSelect={() => go(`/teams/${t.id}`)}>
                  <Shield /> {t.name}
                  <span className="ml-auto text-xs text-muted-foreground">{t.season}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {index.players.length > 0 && (
            <CommandGroup heading="Players">
              {index.players.map((p) => (
                <CommandItem key={p.id} value={`player ${p.name}`} onSelect={() => go(`/players/${p.id}`)}>
                  <Users /> {p.name}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}
