// Power rankings — an ordered, optionally-tiered list ranking teams or players, attributed
// to an author, tagged to a season/week. Centralized service; admin actions + public page
// call these. Entries resolve their team/player names on read.
import { prisma } from "../db";

export type RankKind = "TEAM" | "PLAYER";

export interface RankingEntryView {
  id: string;
  position: number;
  tier: string | null;
  targetId: string | null; // teamSeasonId or playerId
  name: string;
  note: string | null;
}
export interface RankingView {
  id: string;
  kind: RankKind;
  week: number | null;
  title: string;
  author: string | null;
  authorPlayerId: string | null;
  createdAt: Date;
  entries: RankingEntryView[];
}

async function seasonIdOf(seasonName: string): Promise<string | null> {
  const s = await prisma.tourSeason.findUnique({ where: { name: seasonName }, select: { id: true } });
  return s?.id ?? null;
}

// Names for a season's teams + players — the pool for building/reading rankings.
export async function rankingPool(seasonName: string): Promise<{ teams: { id: string; name: string }[]; players: { id: string; name: string }[] }> {
  const sid = await seasonIdOf(seasonName);
  if (!sid) return { teams: [], players: [] };
  const [teamSeasons, entries] = await Promise.all([
    prisma.teamSeason.findMany({ where: { seasonId: sid }, include: { team: true } }),
    prisma.rosterEntry.findMany({ where: { roster: { teamSeason: { seasonId: sid } } }, select: { playerId: true } }),
  ]);
  const pids = [...new Set(entries.map((e) => e.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, displayName: true } });
  return {
    teams: teamSeasons.map((t) => ({ id: t.id, name: t.team.name })).sort((a, b) => a.name.localeCompare(b.name)),
    players: players.map((p) => ({ id: p.id, name: p.displayName })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function listSeasonRankings(seasonName: string): Promise<RankingView[]> {
  const sid = await seasonIdOf(seasonName);
  if (!sid) return [];
  const rankings = await prisma.powerRanking.findMany({ where: { seasonId: sid }, include: { entries: { orderBy: { position: "asc" } } }, orderBy: { createdAt: "desc" } });
  // resolve names for all referenced teams + players
  const tsIds = [...new Set(rankings.flatMap((r) => r.entries.map((e) => e.teamSeasonId).filter((x): x is string => !!x)))];
  const pIds = [...new Set(rankings.flatMap((r) => r.entries.map((e) => e.playerId).filter((x): x is string => !!x)))];
  const [teamSeasons, players] = await Promise.all([
    prisma.teamSeason.findMany({ where: { id: { in: tsIds } }, include: { team: true } }),
    prisma.player.findMany({ where: { id: { in: pIds } }, select: { id: true, displayName: true } }),
  ]);
  const tName = new Map(teamSeasons.map((t) => [t.id, t.team.name]));
  const pName = new Map(players.map((p) => [p.id, p.displayName]));
  return rankings.map((r) => ({
    id: r.id,
    kind: r.kind as RankKind,
    week: r.week,
    title: r.title,
    author: r.author,
    authorPlayerId: r.authorPlayerId,
    createdAt: r.createdAt,
    entries: r.entries.map((e) => ({
      id: e.id,
      position: e.position,
      tier: e.tier,
      targetId: r.kind === "TEAM" ? e.teamSeasonId : e.playerId,
      name: (r.kind === "TEAM" ? (e.teamSeasonId ? tName.get(e.teamSeasonId) : undefined) : e.playerId ? pName.get(e.playerId) : undefined) ?? "?",
      note: e.note,
    })),
  }));
}

export async function getRanking(id: string) {
  return prisma.powerRanking.findUnique({ where: { id }, include: { entries: { orderBy: { position: "asc" } } } });
}

export async function createRanking(seasonName: string, data: { kind: RankKind; week: number | null; title: string; author: string | null; authorPlayerId: string | null }) {
  const sid = await seasonIdOf(seasonName);
  if (!sid) throw new Error("No such season.");
  if (!data.title.trim()) throw new Error("A title is required.");
  return prisma.powerRanking.create({ data: { seasonId: sid, kind: data.kind, week: data.week, title: data.title.trim(), author: data.author?.trim() || null, authorPlayerId: data.authorPlayerId || null } });
}

export async function updateRanking(id: string, data: { week: number | null; title: string; author: string | null; authorPlayerId: string | null }) {
  if (!data.title.trim()) throw new Error("A title is required.");
  return prisma.powerRanking.update({ where: { id }, data: { week: data.week, title: data.title.trim(), author: data.author?.trim() || null, authorPlayerId: data.authorPlayerId || null } });
}

export async function deleteRanking(id: string) {
  await prisma.powerRanking.delete({ where: { id } });
}

// Add an entry — position defaults to the end. targetId is a teamSeasonId or playerId
// depending on the ranking's kind.
export async function addRankingEntry(rankingId: string, data: { targetId: string; tier: string | null; note: string | null; position?: number }) {
  const ranking = await prisma.powerRanking.findUnique({ where: { id: rankingId }, select: { kind: true, entries: { select: { position: true } } } });
  if (!ranking) throw new Error("No such ranking.");
  if (!data.targetId) throw new Error("Pick a team or player.");
  const position = data.position && data.position > 0 ? data.position : Math.max(0, ...ranking.entries.map((e) => e.position)) + 1;
  return prisma.powerRankingEntry.create({
    data: {
      rankingId,
      position,
      tier: data.tier?.trim() || null,
      note: data.note?.trim() || null,
      teamSeasonId: ranking.kind === "TEAM" ? data.targetId : null,
      playerId: ranking.kind === "PLAYER" ? data.targetId : null,
    },
  });
}

export async function removeRankingEntry(entryId: string) {
  await prisma.powerRankingEntry.delete({ where: { id: entryId } });
}
