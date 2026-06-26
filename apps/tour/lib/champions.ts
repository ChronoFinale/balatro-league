// All champions across seasons, each with their playoff run (Hall of Fame).
import { prisma } from "./db";
import { getChampionRun, type ChampionRun } from "./playoffs";

export interface SeasonChampion extends ChampionRun {
  season: string;
}

export async function getAllChampions(): Promise<SeasonChampion[]> {
  const seasons = await prisma.tourSeason.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  const out: SeasonChampion[] = [];
  for (const s of seasons) {
    const run = await getChampionRun(s.name);
    if (run) out.push({ season: s.name, ...run });
  }
  return out;
}
