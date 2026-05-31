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
  // True when this row ties with the row above on points/wins/draws.
  // Set by sortStandings; UI shows a marker so admin can manually break the tie.
  tiedWithPrev?: boolean;
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

// Sort: points DESC → head-to-head (if tied players already played) →
// wins DESC → draws DESC → displayName for stable order. Unbreakable ties
// flagged via tiedWithPrev so admin/UI can resolve via shootout.
function sortStandings(
  rows: StandingRow[],
  pairings: Array<Pick<Pairing, "playerAId" | "playerBId" | "gamesWonA" | "gamesWonB">>,
): StandingRow[] {
  const sorted = rows.slice().sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points;
    const h2h = headToHead(x.player.id, y.player.id, pairings);
    if (h2h !== 0) return h2h;
    if (y.wins !== x.wins) return y.wins - x.wins;
    if (y.draws !== x.draws) return y.draws - x.draws;
    return x.player.displayName.localeCompare(y.player.displayName);
  });
  // Mark rows tied on the entire chain (points/h2h/wins/draws) — admin
  // shootout territory.
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const cur = sorted[i]!;
    if (
      prev.points === cur.points &&
      headToHead(prev.player.id, cur.player.id, pairings) === 0 &&
      prev.wins === cur.wins &&
      prev.draws === cur.draws
    ) {
      cur.tiedWithPrev = true;
    }
  }
  return sorted;
}

// Returns negative if x should sort BEFORE y (x won their match), positive
// if y should sort before x, 0 if they haven't played or drew.
function headToHead(
  xId: string,
  yId: string,
  pairings: Array<Pick<Pairing, "playerAId" | "playerBId" | "gamesWonA" | "gamesWonB">>,
): number {
  const meeting = pairings.find(
    (p) => (p.playerAId === xId && p.playerBId === yId) || (p.playerAId === yId && p.playerBId === xId),
  );
  if (!meeting) return 0;
  const xIsA = meeting.playerAId === xId;
  const xGames = xIsA ? meeting.gamesWonA : meeting.gamesWonB;
  const yGames = xIsA ? meeting.gamesWonB : meeting.gamesWonA;
  // 2-0 only — a 1-1 doesn't break the tie
  if (xGames === 2 && yGames === 0) return -1;
  if (yGames === 2 && xGames === 0) return 1;
  return 0;
}
