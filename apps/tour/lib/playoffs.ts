// The champion's playoff run for a season (Hall of Fame). Handles two shapes:
//   • Historical imports — only the winner's path is recorded (QF→SF→Final), with
//     the champion stored as teamSeasonA in every row (no PlayoffEntry).
//   • Live B8 brackets — a full single-elim bracket (PlayoffEntry seeds + every
//     series). The champion is the crowned team (Championship) or the FINAL winner;
//     the run is the series the champion actually played.
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
  const tsByTeam = new Map(teamSeasons.map((t) => [t.teamId, t.id]));

  // Determine the champion's teamSeason id.
  const [championship, entryCount] = await Promise.all([
    prisma.championship.findFirst({ where: { seasonId: season.id } }),
    prisma.playoffEntry.count({ where: { seasonId: season.id } }),
  ]);
  let championTsId: string | null = null;
  if (championship) {
    championTsId = tsByTeam.get(championship.teamId) ?? null;
  } else if (entryCount === 0) {
    // Historical champion-path import: A is the champion in the (first) row.
    championTsId = [...series].sort((a, b) => (ROUND_ORDER[a.round] ?? 9) - (ROUND_ORDER[b.round] ?? 9))[0]?.teamSeasonAId ?? null;
  } else {
    // Live bracket, not yet crowned → no champion to show.
    const final = series.find((s) => s.round === "FINAL");
    championTsId = final?.winnerTeamSeasonId ?? null;
    if (!championTsId) return null;
  }
  if (!championTsId) return null;

  // The champion's path = the series they appear in, in round order.
  const path = series
    .filter((s) => s.teamSeasonAId === championTsId || s.teamSeasonBId === championTsId)
    .sort((a, b) => (ROUND_ORDER[a.round] ?? 9) - (ROUND_ORDER[b.round] ?? 9));

  return {
    champion: nameById.get(championTsId) ?? "Champion",
    rounds: path.map((s) => {
      const champIsA = s.teamSeasonAId === championTsId;
      const oppId = champIsA ? s.teamSeasonBId : s.teamSeasonAId;
      return {
        round: s.round,
        label: ROUND_LABEL[s.round] ?? s.round,
        opponent: oppId ? nameById.get(oppId) ?? "—" : null,
        champScore: (champIsA ? s.scoreA : s.scoreB) ?? 0,
        oppScore: (champIsA ? s.scoreB : s.scoreA) ?? 0,
      };
    }),
  };
}
