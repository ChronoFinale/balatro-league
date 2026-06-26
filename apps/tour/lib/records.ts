// All-time superlatives + biggest rivalries — pure reductions over the imported
// players + sets. No new data.
import { prisma } from "@/lib/db";
import { getAllTimePlayers } from "@/lib/stats";
import { getDraftSteals } from "@/lib/draft-stats";

const rate = (w: number, l: number) => (w + l ? w / (w + l) : 0);

export interface RecordEntry {
  label: string;
  playerId: string;
  name: string;
  value: string;
  detail: string;
}

export async function getRecords(): Promise<RecordEntry[]> {
  const players = await getAllTimePlayers();
  const qualified = players.filter((p) => p.setW + p.setL >= 20);
  const recs: RecordEntry[] = [];

  const ringed = players.filter((p) => p.rings > 0).sort((a, b) => b.rings - a.rings)[0];
  if (ringed) recs.push({ label: "Most championships", playerId: ringed.playerId, name: ringed.name, value: `${ringed.rings} 💍`, detail: `${ringed.seasons} seasons` });

  const sns = [...players].sort((a, b) => b.seasons - a.seasons)[0];
  if (sns) recs.push({ label: "Most seasons", playerId: sns.playerId, name: sns.name, value: `${sns.seasons}`, detail: "seasons played" });

  const setPct = [...qualified].sort((a, b) => rate(b.setW, b.setL) - rate(a.setW, a.setL))[0];
  if (setPct) recs.push({ label: "Best career set %", playerId: setPct.playerId, name: setPct.name, value: `${(rate(setPct.setW, setPct.setL) * 100).toFixed(1)}%`, detail: `${setPct.setW}–${setPct.setL} (min 20)` });

  const gamePct = [...qualified].sort((a, b) => rate(b.gameW, b.gameL) - rate(a.gameW, a.gameL))[0];
  if (gamePct) recs.push({ label: "Best career game %", playerId: gamePct.playerId, name: gamePct.name, value: `${(rate(gamePct.gameW, gamePct.gameL) * 100).toFixed(1)}%`, detail: `${gamePct.gameW}–${gamePct.gameL} (min 20)` });

  const vol = [...players].sort((a, b) => b.setW + b.setL - (a.setW + a.setL))[0];
  if (vol) recs.push({ label: "Most sets played", playerId: vol.playerId, name: vol.name, value: `${vol.setW + vol.setL}`, detail: `${vol.setW}–${vol.setL}` });

  const steal = (await getDraftSteals(8, 1))[0];
  if (steal) recs.push({ label: "Biggest draft steal", playerId: steal.playerId, name: steal.name, value: `R${steal.round}`, detail: `${steal.season} · ${(steal.pct * 100).toFixed(0)}% (${steal.setW}–${steal.setL})` });

  return recs;
}

export interface Rivalry {
  aId: string;
  aName: string;
  bId: string;
  bName: string;
  total: number;
  aWins: number;
  bWins: number;
}

// All-time most-played player-vs-player matchups (sets), with the head-to-head.
export async function getRivalries(limit = 15): Promise<Rivalry[]> {
  const [sets, matches] = await Promise.all([
    prisma.tourSet.findMany({ select: { playerAId: true, playerBId: true, matchId: true } }),
    prisma.match.findMany({ select: { id: true, winnerId: true } }),
  ]);
  const winById = new Map(matches.map((m) => [m.id, m.winnerId]));
  const pairs = new Map<string, { a: string; b: string; total: number; aWins: number; bWins: number }>();
  for (const ts of sets) {
    if (!ts.matchId) continue;
    const [a, b] = [ts.playerAId, ts.playerBId].sort();
    const key = `${a}|${b}`;
    const p = pairs.get(key) ?? { a, b, total: 0, aWins: 0, bWins: 0 };
    p.total++;
    const w = winById.get(ts.matchId);
    if (w === a) p.aWins++;
    else if (w === b) p.bWins++;
    pairs.set(key, p);
  }
  const top = [...pairs.values()].sort((x, y) => y.total - x.total).slice(0, limit);

  const ids = [...new Set(top.flatMap((p) => [p.a, p.b]))];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));
  return top.map((p) => ({
    aId: p.a,
    aName: nameOf.get(p.a) ?? p.a,
    bId: p.b,
    bName: nameOf.get(p.b) ?? p.b,
    total: p.total,
    aWins: p.aWins,
    bWins: p.bWins,
  }));
}
