// Shared internal helpers + types for the admin loaders. These were
// previously file-private in admin.ts; they're exported here so the
// per-page group files (admin-home / admin-seasons / admin-players) can
// import them. Behavior is unchanged — pure relocation.

import { prisma } from "@/lib/prisma";
import { isScheduleLocked } from "@/lib/schedule-locked";

// Full round-robin match count for a division of N active members.
export function expectedMatchesForDivision(activeMemberCount: number): number {
  return (activeMemberCount * (activeMemberCount - 1)) / 2;
}

// Schedule-aware expected match count per division. When the season is schedule-
// locked (graph or pre-created round-robin), the expected count is the number of
// pre-created matchups between active members, NOT the full round-robin. Otherwise
// it falls back to N*(N-1)/2 and skips the query entirely. Pass each division's
// ACTIVE player-id set.
export async function expectedMatchesBySeason(
  seasonId: string,
  activeByDivision: Map<string, Set<string>>,
  scheduleLocked: boolean,
): Promise<Map<string, number>> {
  const expected = new Map<string, number>();
  // Always load the pre-created schedule. A division is locked if the season flag
  // is set OR it has a 0-0 PENDING match (robust to a stale flag) — then expected =
  // its pre-created matchups; otherwise a full round-robin.
  const matches = await prisma.match.findMany({
    where: { format: "LEAGUE_BO2", division: { seasonId } },
    select: { divisionId: true, playerAId: true, playerBId: true, status: true, gamesWonA: true, gamesWonB: true },
  });
  const byDiv = new Map<string, typeof matches>();
  for (const m of matches) {
    const arr = byDiv.get(m.divisionId);
    if (arr) arr.push(m);
    else byDiv.set(m.divisionId, [m]);
  }
  for (const [divisionId, activeIds] of activeByDivision) {
    const list = byDiv.get(divisionId) ?? [];
    const divLocked = isScheduleLocked(scheduleLocked, list);
    expected.set(
      divisionId,
      divLocked
        ? list.filter((m) => activeIds.has(m.playerAId) && activeIds.has(m.playerBId)).length
        : expectedMatchesForDivision(activeIds.size),
    );
  }
  return expected;
}

export function parseTemplateConfig(json: string): Array<{ name: string; divisionCount: number }> {
  try {
    const arr = JSON.parse(json);
    if (!Array.isArray(arr)) return [];
    return arr.map((e) => ({
      name: String(e?.name ?? ""),
      divisionCount: Number(e?.divisionCount) || 1,
    }));
  } catch {
    return [];
  }
}

export const DEFAULT_TIERS_FALLBACK = [
  { name: "Legendary", divisionCount: 1 },
  { name: "Rare", divisionCount: 6 },
  { name: "Uncommon", divisionCount: 6 },
  { name: "Common", divisionCount: 6 },
];
