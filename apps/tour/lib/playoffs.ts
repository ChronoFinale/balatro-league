// The champion's playoff run for a season (from the imported Hall of Fame data).
// Only the winner's path is recorded historically (QF → SF → Final).
import { prisma } from "./db";

const ROUND_ORDER: Record<string, number> = { QUARTERFINAL: 0, SEMIFINAL: 1, FINAL: 2 };
const ROUND_LABEL: Record<string, string> = {
  QUARTERFINAL: "Quarterfinal",
  SEMIFINAL: "Semifinal",
  FINAL: "Final",
};

export interface RunRound {
  round: string;
  label: string;
  opponent: string | null;
  champScore: number;
  oppScore: number;
}

export interface ChampionRun {
  champion: string;
  rounds: RunRound[];
}

export async function getChampionRun(seasonName: string): Promise<ChampionRun | null> {
  const season = await prisma.tourSeason.findUnique({ where: { name: seasonName }, select: { id: true } });
  if (!season) return null;
  const series = await prisma.playoffSeries.findMany({ where: { seasonId: season.id } });
  if (series.length === 0) return null;

  const ids = [...new Set(series.flatMap((s) => [s.teamSeasonAId, s.teamSeasonBId]).filter((x): x is string => !!x))];
  const teamSeasons = await prisma.teamSeason.findMany({ where: { id: { in: ids } }, include: { team: true } });
  const nameById = new Map(teamSeasons.map((t) => [t.id, t.team.name]));

  const sorted = [...series].sort((a, b) => (ROUND_ORDER[a.round] ?? 9) - (ROUND_ORDER[b.round] ?? 9));
  const champion = (sorted[0]?.teamSeasonAId && nameById.get(sorted[0].teamSeasonAId)) || "Champion";

  return {
    champion,
    rounds: sorted.map((s) => ({
      round: s.round,
      label: ROUND_LABEL[s.round] ?? s.round,
      opponent: s.teamSeasonBId ? (nameById.get(s.teamSeasonBId) ?? "—") : null,
      champScore: s.scoreA ?? 0,
      oppScore: s.scoreB ?? 0,
    })),
  };
}
