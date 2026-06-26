import { prisma } from "@/lib/db";

// Flat index that backs the ⌘K command palette. Small enough (hundreds of rows)
// to ship whole and filter client-side via cmdk. Kept lean — ids + names only,
// no stat aggregation — so opening the palette is cheap.
export type SearchIndex = {
  players: { id: string; name: string }[];
  teams: { id: string; name: string; season: string }[];
  seasons: { name: string }[];
};

export async function getSearchIndex(): Promise<SearchIndex> {
  const [players, teamSeasons, seasons] = await Promise.all([
    prisma.player.findMany({ select: { id: true, displayName: true }, orderBy: { displayName: "asc" } }),
    prisma.teamSeason.findMany({
      select: { id: true, team: { select: { name: true } }, season: { select: { name: true } } },
    }),
    prisma.tourSeason.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);

  return {
    players: players.map((p) => ({ id: p.id, name: p.displayName })),
    teams: teamSeasons.map((t) => ({ id: t.id, name: t.team.name, season: t.season.name })),
    seasons: seasons.map((s) => ({ name: s.name })),
  };
}
