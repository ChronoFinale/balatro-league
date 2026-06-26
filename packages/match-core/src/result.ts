// Pure series-result resolution: tally per-game winners into a Match-level
// result (games won + overall winner + DC flag). Framework- and Prisma-agnostic
// — operates on plain GameState-like objects, returns plain data. The host app
// decides what to do with it (write a Match, normalize a Bo1 to 2-0 for its own
// points math, etc.); the core only counts what actually happened.
//
// Ported from the league's guided match-completion + shootout tally
// (src/commands/match-buttons.ts) so both apps resolve identical results.

// The minimal slice of a game we need to tally a series. Any object carrying a
// confirmed `winnerId` (and optionally a `dcByPlayerId`) qualifies — including a
// full `GameState`.
export interface GameResultLike {
  winnerId?: string;
  dcByPlayerId?: string;
}

export interface SeriesResult {
  // Wins for the two players, in the order they were passed. Callers using
  // canonical ordering (playerA.id < playerB.id) pass them in that order so
  // these map straight onto Match.gamesWonA / gamesWonB.
  gamesWonA: number;
  gamesWonB: number;
  // The id that won more games, or null for a draw / no decisive result.
  winnerId: string | null;
  // True if ANY game in the series was decided by a disconnect forfeit — a
  // top-level flag so audit/history can filter without parsing every game.
  hadDc: boolean;
}

// Count decisive games per player and derive the overall winner. Games that are
// null/undefined or have no winner yet are skipped, so this is safe to call on a
// partially-played series (it just reflects the games decided so far).
export function resolveSeriesResult(
  games: ReadonlyArray<GameResultLike | null | undefined>,
  playerAId: string,
  playerBId: string,
): SeriesResult {
  let gamesWonA = 0;
  let gamesWonB = 0;
  let hadDc = false;
  for (const g of games) {
    if (!g) continue;
    if (g.dcByPlayerId) hadDc = true;
    if (g.winnerId === playerAId) gamesWonA++;
    else if (g.winnerId === playerBId) gamesWonB++;
  }
  const winnerId = gamesWonA > gamesWonB ? playerAId : gamesWonB > gamesWonA ? playerBId : null;
  return { gamesWonA, gamesWonB, winnerId, hadDc };
}
