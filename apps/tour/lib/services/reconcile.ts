// Reconstruct Week + Matchup rows for an IMPORTED season from its flat TourSets.
// Imported seasons store every played game as a loose TourSet (seasonId + week Int +
// teamSeasonAId/BId + playerAId/BId), with matchupId null and no Week/Matchup rows --
// the importer computes the schedule then discards it. This rebuilds it from the data
// already in the DB, so the matchup-based tooling (audit, overlays, matchup reads,
// standings) works on imported seasons too.
//
// Correctness hinge: rollupMatchup credits a set's win to the MATCHUP's team A only when
// the set's playerA is on team A (it aligns by player id). So when we pick a canonical
// team A/B for each (week, team-pair) group, any set stored in the opposite orientation
// is swapped (teamSeason/player/seed A<->B) so its playerA lands on the matchup's team A.
// The linked Match row is left untouched -- rollup re-aligns games/winner by player id.
//
// REGULAR bracket only; playoff sets (bracket PLAYOFF, week null) stay in PlayoffSeries.
// Idempotent: detaches existing links and rebuilds from scratch each run.
import { prisma } from "../db";
import { rollupMatchup } from "./report";

export async function buildMatchupsFromSets(seasonName: string) {
  const season = await prisma.tourSeason.findUnique({ where: { name: seasonName }, select: { id: true } });
  if (!season) throw new Error(`No season "${seasonName}"`);

  // Detach any prior set->matchup links BEFORE dropping matchups (Matchup->TourSet is
  // onDelete: Cascade; deleting an attached matchup would delete the imported sets).
  await prisma.tourSet.updateMany({ where: { seasonId: season.id, matchupId: { not: null } }, data: { matchupId: null } });
  await prisma.week.deleteMany({ where: { seasonId: season.id } });

  const sets = await prisma.tourSet.findMany({
    where: { seasonId: season.id, week: { not: null }, bracket: "REGULAR", teamSeasonAId: { not: null }, teamSeasonBId: { not: null } },
    select: { id: true, week: true, teamSeasonAId: true, teamSeasonBId: true, playerAId: true, playerBId: true, seedA: true, seedB: true },
  });
  if (sets.length === 0) return { weeks: 0, matchups: 0, sets: 0, flipped: 0 };

  // Group by (week, unordered team pair). Canonical team A = lexicographically smaller id.
  type SetRow = (typeof sets)[number];
  const groups = new Map<string, { week: number; teamA: string; teamB: string; rows: SetRow[] }>();
  for (const s of sets) {
    const x = s.teamSeasonAId!, y = s.teamSeasonBId!;
    const [teamA, teamB] = x < y ? [x, y] : [y, x];
    const key = `${s.week}|${teamA}|${teamB}`;
    const g = groups.get(key) ?? { week: s.week!, teamA, teamB, rows: [] };
    g.rows.push(s);
    groups.set(key, g);
  }

  const weekNums = [...new Set([...groups.values()].map((g) => g.week))].sort((a, b) => a - b);
  const weekIdByNum = new Map<number, string>();
  for (const num of weekNums) {
    const wk = await prisma.week.create({ data: { seasonId: season.id, number: num, kind: "ROUND_ROBIN" } });
    weekIdByNum.set(num, wk.id);
  }

  const matchupIds: string[] = [];
  let flipped = 0;
  for (const g of groups.values()) {
    const mu = await prisma.matchup.create({
      data: { weekId: weekIdByNum.get(g.week)!, teamSeasonAId: g.teamA, teamSeasonBId: g.teamB },
    });
    matchupIds.push(mu.id);

    const straight = g.rows.filter((s) => s.teamSeasonAId === g.teamA).map((s) => s.id);
    if (straight.length) await prisma.tourSet.updateMany({ where: { id: { in: straight } }, data: { matchupId: mu.id } });

    // Opposite-orientation sets: swap A<->B so playerA is on the matchup's team A.
    for (const s of g.rows.filter((r) => r.teamSeasonAId !== g.teamA)) {
      flipped++;
      await prisma.tourSet.update({
        where: { id: s.id },
        data: {
          matchupId: mu.id,
          teamSeasonAId: s.teamSeasonBId, teamSeasonBId: s.teamSeasonAId,
          playerAId: s.playerBId, playerBId: s.playerAId,
          seedA: s.seedB, seedB: s.seedA,
        },
      });
    }
  }

  for (const id of matchupIds) await rollupMatchup(id);

  return { weeks: weekNums.length, matchups: matchupIds.length, sets: sets.length, flipped };
}
