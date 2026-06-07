// Loader for /admin/traits — the trait editor + "who has what" overview.
// Merges the code TRAIT_REGISTRY catalog with any admin TraitOverride rows,
// and buckets every player who currently earns each trait.

import { prisma } from "@/lib/prisma";
import { TRAIT_REGISTRY, loadPlayerTraits, loadTraitOverrides } from "./player-traits";

// Above this many trait-eligible players, skip the per-player holder scan so a
// large seeded DB can't hang the page — the catalog still renders.
const MAX_HOLDER_PLAYERS = 500;
// Max concurrent per-player Game queries — keeps us well under the pool limit.
const HOLDER_CONCURRENCY = 10;

export interface TraitHolder {
  id: string;
  name: string;
}

export interface TraitAdminRow {
  key: string;
  // Effective (override-or-default) presentation.
  label: string;
  emoji: string;
  description: string;
  iconDataUrl: string | null;
  // Plain-language gating rule (how the trait is earned). Read-only.
  criteria: string;
  // The code defaults, so the editor can show "default: …" hints.
  defaultLabel: string;
  defaultEmoji: string;
  defaultDescription: string;
  // True if any override row exists for this key.
  overridden: boolean;
  // Players who currently earn this trait, by display name.
  holders: TraitHolder[];
}

export async function loadTraitsAdmin(): Promise<TraitAdminRow[]> {
  const overrides = await loadTraitOverrides();

  // Compute each player's traits and bucket holders by trait key. This is one
  // Game query per player, so we must NOT fire them all at once — Promise.all
  // over hundreds of players exhausts the connection pool and times the page
  // out. Process in small concurrent batches, cap the total (a huge seeded DB
  // shouldn't hang the public page), and never let a failure here (including
  // the players query) break the page — the catalog still renders.
  const holdersByKey = new Map<string, TraitHolder[]>();
  try {
    // Only players with at least one confirmed match can earn anything.
    const players = await prisma.player.findMany({
      where: {
        OR: [
          { matchesAsA: { some: { status: "CONFIRMED" } } },
          { matchesAsB: { some: { status: "CONFIRMED" } } },
        ],
      },
      select: { id: true, displayName: true },
    });
    if (players.length > 0 && players.length <= MAX_HOLDER_PLAYERS) {
      for (let i = 0; i < players.length; i += HOLDER_CONCURRENCY) {
        const batch = players.slice(i, i + HOLDER_CONCURRENCY);
        const results = await Promise.all(
          batch.map(async (p) => ({ p, traits: await loadPlayerTraits(p.id, overrides) })),
        );
        for (const { p, traits } of results) {
          for (const t of traits) {
            const arr = holdersByKey.get(t.key) ?? [];
            arr.push({ id: p.id, name: p.displayName });
            holdersByKey.set(t.key, arr);
          }
        }
      }
      for (const arr of holdersByKey.values()) arr.sort((a, b) => a.name.localeCompare(b.name));
    }
  } catch {
    holdersByKey.clear();
  }

  return TRAIT_REGISTRY.map((def) => {
    const ov = overrides.get(def.key);
    return {
      key: def.key,
      label: ov?.label ?? def.label,
      emoji: ov?.emoji ?? def.emoji,
      description: ov?.description ?? def.description,
      iconDataUrl: ov?.iconDataUrl ?? null,
      criteria: def.criteria,
      defaultLabel: def.label,
      defaultEmoji: def.emoji,
      defaultDescription: def.description,
      overridden: !!ov,
      holders: holdersByKey.get(def.key) ?? [],
    };
  });
}
