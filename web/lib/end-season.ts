// End-of-season rank computation. Replaces the previous tier-baseline
// math with a simple global rank: the strongest player league-wide
// gets rank 1, the weakest gets rank N. Next season's build sorts
// by rank ASC so rank 1 lands in the top tier, etc — produces the
// same tier movement as the old algorithm without the baseline magic.
//
// Sort key (best → worst):
//   1. Tier position (lower = better tier — Legendary first)
//   2. Within tier: finishing position in division (1 first)
//
// DROPPED players keep their existing rank (no penalty). Ranks are
// integers 1..N over ACTIVE players only.

import type { StandingRow } from "./standings";

export interface DivisionForRating {
  tierPosition: number; // 1 = top tier
  members: Array<{ playerId: string; status: "ACTIVE" | "DROPPED"; currentRating: number | null }>;
  standings: StandingRow[];
}

export interface RatingDelta {
  playerId: string;
  displayName: string;
  oldRating: number | null;
  newRating: number;
  delta: number;
  tierPosition: number;
  finishPosition: number;
  divisionSize: number;
}

// numTiers retained on the signature for endSeason caller compat; the
// new algorithm doesn't need it (the global rank is derived purely
// from tier position + within-division finish).
export function computeRatingDeltas(
  numTiers: number,
  divisions: DivisionForRating[],
): RatingDelta[] {
  void numTiers;
  // Flatten: every (player, tierPosition, finishPosition, divisionSize)
  // pair across all divisions, ACTIVE only. Then sort by tier asc,
  // finish asc → that's the global rank.
  interface FlatEntry {
    playerId: string;
    displayName: string;
    oldRating: number | null;
    tierPosition: number;
    finishPosition: number; // 1-indexed within division
    divisionSize: number;
  }
  const entries: FlatEntry[] = [];
  for (const div of divisions) {
    const droppedSet = new Set(
      div.members.filter((m) => m.status === "DROPPED").map((m) => m.playerId),
    );
    const oldByPlayer = new Map(div.members.map((m) => [m.playerId, m.currentRating]));
    const active = div.standings.filter((row) => !droppedSet.has(row.player.id));
    active.forEach((row, idx) => {
      entries.push({
        playerId: row.player.id,
        displayName: row.player.displayName,
        oldRating: oldByPlayer.get(row.player.id) ?? null,
        tierPosition: div.tierPosition,
        finishPosition: idx + 1,
        divisionSize: active.length,
      });
    });
  }
  // Global rank ordering: top tier first, then by finish within tier.
  entries.sort((a, b) => {
    if (a.tierPosition !== b.tierPosition) return a.tierPosition - b.tierPosition;
    return a.finishPosition - b.finishPosition;
  });
  return entries.map((e, i) => {
    const newRating = i + 1;
    return {
      playerId: e.playerId,
      displayName: e.displayName,
      oldRating: e.oldRating,
      newRating,
      delta: newRating - (e.oldRating ?? 0),
      tierPosition: e.tierPosition,
      finishPosition: e.finishPosition,
      divisionSize: e.divisionSize,
    };
  });
}
