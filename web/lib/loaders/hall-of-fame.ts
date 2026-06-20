import "server-only";

// Hall of Fame: the champions of every COMPLETED season. For each ended (and not
// archived) season we recompute the final standings of every division and crown
// its #1 — the top division's winner is the league champion (shown with their
// full match log), and each other division's winner is listed too.

import { prisma } from "@/lib/prisma";
import { computeStandings, assignRanks } from "@/lib/standings";
import { formatSeasonLabel } from "@/lib/format-season";

export interface HofMatch {
  opponentId: string;
  opponentName: string;
  myGames: number;
  oppGames: number;
  outcome: "win" | "loss" | "draw" | "void";
}
export interface HofDivisionWinner {
  divisionName: string;
  isTopDivision: boolean;
  playerId: string;
  playerName: string;
  discordId: string;
  record: string; // W-L-D
  points: number;
}
export interface HofChampion {
  playerId: string;
  playerName: string;
  discordId: string;
  divisionName: string;
  record: string;
  points: number;
}
export interface HofSeason {
  seasonId: string;
  seasonLabel: string;
  seasonNumber: number;
  endedAt: Date;
  champion: HofChampion | null;
  championMatches: HofMatch[];
  divisionWinners: HofDivisionWinner[];
}

export async function loadHallOfFame(): Promise<HofSeason[]> {
  const seasons = await prisma.season.findMany({
    where: { endedAt: { not: null }, archivedAt: null },
    orderBy: { number: "desc" },
    select: {
      id: true,
      number: true,
      subtitle: true,
      endedAt: true,
      tiers: {
        orderBy: { position: "asc" },
        select: {
          divisions: {
            orderBy: { groupNumber: "asc" },
            select: {
              id: true,
              name: true,
              members: { where: { status: "ACTIVE" }, select: { player: true } },
              matches: {
                where: { status: "CONFIRMED", format: { in: ["LEAGUE_BO2", "SHOOTOUT_BO1"] } },
                select: {
                  playerAId: true,
                  playerBId: true,
                  gamesWonA: true,
                  gamesWonB: true,
                  winnerId: true,
                  format: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const out: HofSeason[] = [];
  for (const s of seasons) {
    // Ladder order: tier position, then group number — so the first division is
    // the top of the league (its winner is the champion).
    const ladder = s.tiers.flatMap((t) => t.divisions);
    const divisionWinners: HofDivisionWinner[] = [];
    let champion: HofChampion | null = null;
    let championMatches: HofMatch[] = [];

    ladder.forEach((d, idx) => {
      const players = d.members.map((m) => m.player);
      if (players.length === 0) return;
      const bo2 = d.matches.filter((m) => m.format === "LEAGUE_BO2");
      const shootouts = d.matches
        .filter((m) => m.format === "SHOOTOUT_BO1" && m.winnerId)
        .map((m) => ({ playerAId: m.playerAId, playerBId: m.playerBId, winnerId: m.winnerId! }));
      const rows = assignRanks(computeStandings(players, bo2, shootouts));
      const top = rows[0];
      if (!top) return;

      const record = `${top.wins}-${top.losses}-${top.draws}`;
      const isTopDivision = idx === 0;
      divisionWinners.push({
        divisionName: d.name,
        isTopDivision,
        playerId: top.player.id,
        playerName: top.player.displayName,
        discordId: top.player.discordId,
        record,
        points: top.points,
      });

      if (isTopDivision) {
        champion = {
          playerId: top.player.id,
          playerName: top.player.displayName,
          discordId: top.player.discordId,
          divisionName: d.name,
          record,
          points: top.points,
        };
        const nameById = new Map(players.map((p) => [p.id, p.displayName]));
        championMatches = bo2
          .filter((m) => m.playerAId === top.player.id || m.playerBId === top.player.id)
          .map((m) => {
            const meIsA = m.playerAId === top.player.id;
            const myGames = meIsA ? m.gamesWonA : m.gamesWonB;
            const oppGames = meIsA ? m.gamesWonB : m.gamesWonA;
            const opponentId = meIsA ? m.playerBId : m.playerAId;
            const outcome: HofMatch["outcome"] =
              myGames === 0 && oppGames === 0
                ? "void"
                : myGames > oppGames
                  ? "win"
                  : myGames < oppGames
                    ? "loss"
                    : "draw";
            return { opponentId, opponentName: nameById.get(opponentId) ?? "Unknown", myGames, oppGames, outcome };
          });
      }
    });

    out.push({
      seasonId: s.id,
      seasonLabel: formatSeasonLabel(s),
      seasonNumber: s.number,
      endedAt: s.endedAt!,
      champion,
      championMatches,
      divisionWinners,
    });
  }
  return out;
}
