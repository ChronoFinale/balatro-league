// Derive a season's team standings from the imported sets, using the generic
// competition-core engine + the Tour §5 tiebreaker chain. Proves data → standings.
// Run with tsx (it imports the TS workspace package): `npm run standings -- "Team Tour 3"`

import { computeStandings, metricPct, inGroupMetricPct, headToHead } from "@balatro/competition-core";
import prismaPkg from "../prisma/generated/client/index.js";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const TOUR_TIEBREAKERS = [
  metricPct("matchups"),
  metricPct("sets"),
  metricPct("games"),
  inGroupMetricPct("matchups"),
  headToHead(),
];

const seasonName = process.argv[2] ?? "Team Tour 3";
const season = await prisma.tourSeason.findUnique({
  where: { name: seasonName },
  include: { teamSeasons: { include: { team: true, rosters: { include: { entries: true } } } } },
});
if (!season) {
  console.error(`no season "${seasonName}"`);
  process.exit(1);
}

const teamOfPlayer = new Map();
const teamName = new Map();
const confOfTeam = new Map();
const participants = [];
for (const ts of season.teamSeasons) {
  teamName.set(ts.id, ts.team.name);
  confOfTeam.set(ts.id, ts.conferenceId);
  participants.push({ id: ts.id, groupId: ts.conferenceId });
  for (const r of ts.rosters) for (const e of r.entries) teamOfPlayer.set(e.playerId, ts.id);
}

const sets = await prisma.tourSet.findMany({
  where: { seasonId: season.id },
  select: { playerAId: true, playerBId: true, matchId: true },
});
const matches = await prisma.match.findMany({
  where: { id: { in: sets.map((s) => s.matchId).filter(Boolean) } },
  select: { id: true, playerAId: true, gamesWonA: true, gamesWonB: true },
});
const matchById = new Map(matches.map((m) => [m.id, m]));

// Group sets into team-vs-team matchups (each team pair plays once per season).
const pair = new Map();
let skipped = 0;
for (const s of sets) {
  const tA = teamOfPlayer.get(s.playerAId);
  const tB = teamOfPlayer.get(s.playerBId);
  const m = matchById.get(s.matchId);
  if (!tA || !tB || tA === tB || !m) {
    skipped++;
    continue;
  }
  const gA = m.playerAId === s.playerAId ? m.gamesWonA : m.gamesWonB;
  const gB = m.playerAId === s.playerAId ? m.gamesWonB : m.gamesWonA;
  const [x, y] = tA < tB ? [tA, tB] : [tB, tA];
  const key = `${x}|${y}`;
  let a = pair.get(key);
  if (!a) {
    a = { x, y, setsX: 0, setsY: 0, gamesX: 0, gamesY: 0 };
    pair.set(key, a);
  }
  const gX = tA === x ? gA : gB;
  const gY = tA === x ? gB : gA;
  a.gamesX += gX;
  a.gamesY += gY;
  const setWinTeam = gA > gB ? tA : gB > gA ? tB : null;
  if (setWinTeam === x) a.setsX++;
  else if (setWinTeam === y) a.setsY++;
}

const results = [];
for (const a of pair.values()) {
  const outcome = a.setsX > a.setsY ? "HOME" : a.setsY > a.setsX ? "AWAY" : "DRAW";
  results.push({
    homeId: a.x,
    awayId: a.y,
    groupId: confOfTeam.get(a.x),
    outcome,
    metrics: {
      matchups: outcome === "HOME" ? [1, 0] : outcome === "AWAY" ? [0, 1] : [0, 0],
      sets: [a.setsX, a.setsY],
      games: [a.gamesX, a.gamesY],
    },
  });
}

const standings = computeStandings(participants, results, { tiebreakers: TOUR_TIEBREAKERS });
console.log(`\n${seasonName} — ${sets.length} sets, ${pair.size} matchups (skipped ${skipped} non-team sets)\n`);
for (const [, rows] of standings) {
  rows.forEach((r, i) => {
    const mr = r.metrics.matchups ?? { for: 0, against: 0 };
    const sr = r.metrics.sets ?? { for: 0, against: 0 };
    const gr = r.metrics.games ?? { for: 0, against: 0 };
    const name = (teamName.get(r.participantId) ?? r.participantId).padEnd(26);
    console.log(
      `${String(i + 1).padStart(2)}. ${name}  matchups ${mr.for}-${mr.against}   sets ${sr.for}-${sr.against}   games ${gr.for}-${gr.against}`,
    );
  });
}
await prisma.$disconnect();
