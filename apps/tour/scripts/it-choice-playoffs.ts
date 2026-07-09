// End-to-end integration test (DEV DB) for overall-seed choose-your-opponent playoffs.
// Builds the bracket from picks on the dev "Team Tour 4" copy, drives every series
// through the normal reportSet path, asserts standard seeding (#1/#2 meet only in the
// final; halves {1,4},{2,3}) + advancement + no standings pollution, then restores.
// Run: cd apps/tour && npx tsx scripts/it-choice-playoffs.ts
import { prisma } from "../lib/db";
import { getSeasonStandings } from "../lib/standings";
import { startChoiceBracket, resetPlayoffs } from "../lib/services/playoffs";
import { reportSet } from "../lib/services/report";

const SEASON = "Team Tour 4";
let ok = true;
const check = (label: string, cond: boolean) => { console.log(`  ${cond ? "OK  " : "FAIL"} ${label}`); if (!cond) ok = false; };
const pct = (w: number, l: number) => (w + l ? w / (w + l) : 0);

async function cleanup(seasonId: string, priorState: string) {
  const pweeks = await prisma.week.findMany({ where: { seasonId, kind: "PLAYOFF" as never }, select: { id: true } });
  const wids = pweeks.map((w) => w.id);
  if (wids.length) {
    const psets = await prisma.tourSet.findMany({ where: { matchup: { weekId: { in: wids } } }, select: { matchId: true } });
    const mids = psets.map((s) => s.matchId).filter((x): x is string => !!x);
    if (mids.length) await prisma.match.deleteMany({ where: { id: { in: mids } } });
    await prisma.week.deleteMany({ where: { id: { in: wids } } });
  }
  await resetPlayoffs(SEASON).catch(() => {});
  await prisma.tourSeason.update({ where: { id: seasonId }, data: { state: priorState as never } });
}

async function aPlayerOf(teamSeasonId: string): Promise<string | null> {
  const e = await prisma.rosterEntry.findFirst({ where: { roster: { teamSeasonId } }, select: { playerId: true } });
  return e?.playerId ?? null;
}

// Drive a series to a decision through the real report path: one set, team A (higher seed) wins.
async function decideSeries(matchupId: string, seasonId: string) {
  const mu = await prisma.matchup.findUnique({ where: { id: matchupId }, select: { teamSeasonAId: true, teamSeasonBId: true } });
  if (!mu) throw new Error("no matchup");
  const [pa, pb] = await Promise.all([aPlayerOf(mu.teamSeasonAId), aPlayerOf(mu.teamSeasonBId)]);
  if (!pa || !pb) throw new Error("teams have no roster players to pair");
  const set = await prisma.tourSet.create({
    data: { matchupId, seasonId, playerAId: pa, playerBId: pb, seedA: 1, seedB: 1, bestOf: 1, status: "PROPOSED",
      teamSeasonAId: mu.teamSeasonAId, teamSeasonBId: mu.teamSeasonBId, bracket: "PLAYOFF" },
  });
  await reportSet(set.id, 1, 0);
}

async function rows(seasonId: string) {
  return prisma.playoffSeries.findMany({ where: { seasonId }, orderBy: [{ round: "asc" }, { bracketIndex: "asc" }],
    select: { round: true, bracketIndex: true, conferenceId: true, teamSeasonAId: true, teamSeasonBId: true, scoreA: true, scoreB: true, winnerTeamSeasonId: true, matchupId: true } });
}

async function main() {
  const season = await prisma.tourSeason.findUnique({ where: { name: SEASON }, select: { id: true, state: true } });
  if (!season) throw new Error(`no dev season ${SEASON}`);
  const priorState = season.state;
  console.log(`Dev season ${SEASON} [${priorState}] -- cleaning any prior bracket first.`);
  await cleanup(season.id, priorState);

  // Overall seeding (matchup% -> set% -> game%), same as computeSeededField.
  const s = await getSeasonStandings(SEASON);
  if (!s) throw new Error("no standings");
  const seeded = s.groups
    .flatMap((g) => g.rows.map((r) => ({ id: r.teamSeasonId, name: r.name, m: pct(r.matchupsW, r.matchupsL), se: pct(r.setsW, r.setsL), g: pct(r.gamesW, r.gamesL) })))
    .sort((a, b) => b.m - a.m || b.se - a.se || b.g - a.g)
    .slice(0, s.playoffTeams);
  const id = (seed: number) => seeded[seed - 1]!.id; // seed is 1-based
  console.log(`Seeds: ${seeded.map((x, i) => `${i + 1}:${x.name}`).join("  ")}`);

  // #1 picks #8, #2 picks #7, #3 picks #6; #4 auto-plays #5.
  const picks = [
    { chooserTeamSeasonId: id(1), chosenOpponentTeamSeasonId: id(8) },
    { chooserTeamSeasonId: id(2), chosenOpponentTeamSeasonId: id(7) },
    { chooserTeamSeasonId: id(3), chosenOpponentTeamSeasonId: id(6) },
  ];
  const built = await startChoiceBracket(SEASON, picks);
  check(`start returns 8-team field, 4 first-round series`, built.field === 8 && built.series === 4);

  let r = await rows(season.id);
  const qf = r.filter((x) => x.round === "QUARTERFINAL");
  check(`4 QF series, each with a live matchup and no conference (merged bracket)`, qf.length === 4 && qf.every((x) => x.matchupId && x.conferenceId === null));
  // Standard seeding placement: bracketIndex 0=#1v#8, 1=#4v#5, 2=#2v#7, 3=#3v#6 (higher seed = A).
  const pairAt = (bi: number) => { const x = qf.find((q) => q.bracketIndex === bi)!; return [x.teamSeasonAId, x.teamSeasonBId]; };
  check(`QF0 = #1 vs #8`, pairAt(0)[0] === id(1) && pairAt(0)[1] === id(8));
  check(`QF1 = #4 vs #5 (shares #1's half -> {1,4})`, pairAt(1)[0] === id(4) && pairAt(1)[1] === id(5));
  check(`QF2 = #2 vs #7`, pairAt(2)[0] === id(2) && pairAt(2)[1] === id(7));
  check(`QF3 = #3 vs #6 (shares #2's half -> {2,3})`, pairAt(3)[0] === id(3) && pairAt(3)[1] === id(6));

  console.log(`\nDriving QF (higher seed wins each)...`);
  for (const x of qf) await decideSeries(x.matchupId!, season.id);
  r = await rows(season.id);
  const sf = r.filter((x) => x.round === "SEMIFINAL");
  check(`2 SF auto-created`, sf.length === 2 && sf.every((x) => x.matchupId));
  const sfPair = (bi: number) => { const x = sf.find((q) => q.bracketIndex === bi)!; return [x.teamSeasonAId, x.teamSeasonBId].sort(); };
  check(`SF0 = #1 vs #4`, sfPair(0).join() === [id(1), id(4)].sort().join());
  check(`SF1 = #2 vs #3`, sfPair(1).join() === [id(2), id(3)].sort().join());

  console.log(`\nDriving SF...`);
  for (const x of sf) await decideSeries(x.matchupId!, season.id);
  r = await rows(season.id);
  const fin = r.find((x) => x.round === "FINAL")!;
  check(`FINAL is #1 vs #2 (top two meet only in the final)`, !!fin && [fin.teamSeasonAId, fin.teamSeasonBId].sort().join() === [id(1), id(2)].sort().join());

  console.log(`\nDriving FINAL...`);
  await decideSeries(fin.matchupId!, season.id);
  r = await rows(season.id);
  check(`champion = #1`, r.find((x) => x.round === "FINAL")!.winnerTeamSeasonId === id(1));

  const after = await getSeasonStandings(SEASON);
  const same = after!.groups.every((g, i) => g.rows.map((x) => x.teamSeasonId).join() === s.groups[i]!.rows.map((x) => x.teamSeasonId).join());
  check(`regular-season standings unchanged by playoff matchups`, same);

  console.log(`\nCleaning up...`);
  await cleanup(season.id, priorState);
  const lw = await prisma.week.count({ where: { seasonId: season.id, kind: "PLAYOFF" as never } });
  const ls = await prisma.playoffSeries.count({ where: { seasonId: season.id } });
  check(`cleanup removed playoff weeks + series`, lw === 0 && ls === 0);

  console.log(`\n${ok ? "ALL CHECKS PASSED" : "SOME CHECKS FAILED"}`);
  process.exit(ok ? 0 : 1);
}
main().catch(async (e) => { console.error(e); process.exit(1); });
