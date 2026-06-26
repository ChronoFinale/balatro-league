// Read model for imported awards (currently MVP only — see parse-awards.mjs).
import { prisma } from "@/lib/db";

const KIND_LABEL: Record<string, string> = {
  MVP: "MVP",
  ROOKIE: "Rookie of the Season",
  COMEBACK: "Comeback Player",
  CAPTAIN: "Captain of the Season",
  MOST_IMPROVED: "Most Improved",
  BEST_SET: "Best Set",
  BIGGEST_STEAL: "Biggest Steal",
};

export interface SeasonAward {
  kind: string;
  label: string;
  playerId: string | null;
  player: string | null;
  team: string | null;
}

export async function getSeasonAwards(seasonName: string): Promise<SeasonAward[]> {
  const season = await prisma.tourSeason.findUnique({ where: { name: seasonName }, select: { id: true } });
  if (!season) return [];
  const awards = await prisma.award.findMany({ where: { seasonId: season.id } });
  const players = await prisma.player.findMany({
    where: { id: { in: awards.map((a) => a.playerId).filter((x): x is string => !!x) } },
    select: { id: true, displayName: true },
  });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));
  return awards.map((a) => ({
    kind: a.kind,
    label: KIND_LABEL[a.kind] ?? a.kind,
    playerId: a.playerId,
    player: a.playerId ? nameOf.get(a.playerId) ?? null : null,
    team: (a.meta as { team?: string } | null)?.team ?? null,
  }));
}

export async function getPlayerAwards(playerId: string): Promise<{ kind: string; label: string; season: string }[]> {
  const awards = await prisma.award.findMany({ where: { playerId } });
  const seasons = await prisma.tourSeason.findMany({
    where: { id: { in: awards.map((a) => a.seasonId) } },
    select: { id: true, name: true },
  });
  const nameOf = new Map(seasons.map((s) => [s.id, s.name]));
  const num = (s: string) => Number(s.match(/(\d+)/)?.[1] ?? 0);
  return awards
    .map((a) => ({ kind: a.kind, label: KIND_LABEL[a.kind] ?? a.kind, season: nameOf.get(a.seasonId) ?? a.seasonId }))
    .sort((x, y) => num(x.season) - num(y.season));
}
