// Pure functions for computing standings. Mirrors the bot's src/standings.ts.

import type { Pairing, Player } from "@prisma/client";

const POINTS_FOR_2_0_WIN = 3;
const POINTS_FOR_1_1_DRAW = 1;

export interface StandingRow {
  player: Player;
  points: number;
  wins: number;       // 2-0 results
  draws: number;      // 1-1 results
  losses: number;     // 0-2 results
  gamesWon: number;
  gamesLost: number;
  played: number;     // confirmed pairings
  dropped?: boolean;
}

export function computeStandings(
  players: Player[],
  pairings: Array<Pick<Pairing, "playerAId" | "playerBId" | "gamesWonA" | "gamesWonB">>,
): StandingRow[] {
  const byId = new Map<string, StandingRow>();
  for (const p of players) {
    byId.set(p.id, {
      player: p,
      points: 0, wins: 0, draws: 0, losses: 0,
      gamesWon: 0, gamesLost: 0, played: 0,
    });
  }

  for (const pr of pairings) {
    const a = byId.get(pr.playerAId);
    const b = byId.get(pr.playerBId);
    if (!a || !b) continue;
    a.played++; b.played++;
    a.gamesWon += pr.gamesWonA; a.gamesLost += pr.gamesWonB;
    b.gamesWon += pr.gamesWonB; b.gamesLost += pr.gamesWonA;

    if (pr.gamesWonA === 2 && pr.gamesWonB === 0) {
      a.points += POINTS_FOR_2_0_WIN; a.wins++; b.losses++;
    } else if (pr.gamesWonA === 0 && pr.gamesWonB === 2) {
      b.points += POINTS_FOR_2_0_WIN; b.wins++; a.losses++;
    } else if (pr.gamesWonA === 1 && pr.gamesWonB === 1) {
      a.points += POINTS_FOR_1_1_DRAW; b.points += POINTS_FOR_1_1_DRAW;
      a.draws++; b.draws++;
    }
  }

  return sortStandings(Array.from(byId.values()), pairings);
}

function sortStandings(
  rows: StandingRow[],
  pairings: Array<Pick<Pairing, "playerAId" | "playerBId" | "gamesWonA" | "gamesWonB">>,
): StandingRow[] {
  return rows.slice().sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const h2h = headToHead(x.player.id, y.player.id, pairings);
    if (h2h.x !== h2h.y) return h2h.y - h2h.x;
    const xDiff = x.gamesWon - x.gamesLost;
    const yDiff = y.gamesWon - y.gamesLost;
    if (yDiff !== xDiff) return yDiff - xDiff;
    if (y.gamesWon !== x.gamesWon) return y.gamesWon - x.gamesWon;
    return x.player.displayName.localeCompare(y.player.displayName);
  });
}

function headToHead(
  xId: string, yId: string,
  pairings: Array<Pick<Pairing, "playerAId" | "playerBId" | "gamesWonA" | "gamesWonB">>,
): { x: number; y: number } {
  const meeting = pairings.find(
    (p) => (p.playerAId === xId && p.playerBId === yId) || (p.playerAId === yId && p.playerBId === xId),
  );
  if (!meeting) return { x: 0, y: 0 };
  const xIsA = meeting.playerAId === xId;
  const xGames = xIsA ? meeting.gamesWonA : meeting.gamesWonB;
  const yGames = xIsA ? meeting.gamesWonB : meeting.gamesWonA;
  if (xGames === 2 && yGames === 0) return { x: POINTS_FOR_2_0_WIN, y: 0 };
  if (yGames === 2 && xGames === 0) return { x: 0, y: POINTS_FOR_2_0_WIN };
  if (xGames === 1 && yGames === 1) return { x: POINTS_FOR_1_1_DRAW, y: POINTS_FOR_1_1_DRAW };
  return { x: 0, y: 0 };
}
