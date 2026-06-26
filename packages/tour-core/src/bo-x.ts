// Bo-X → Bo3 normalization for the GAME-level tiebreaker (design §12.4, the live
// `Info.html` "credits to dsc" table). Variable set lengths must compare fairly,
// so every set collapses to Bo3 terms: the winner always gets 2, and the loser
// gets 1 (competitive) iff they won "enough" games, else 0 (a sweep).
//
// The source table specifies Bo3/Bo5/Bo7 explicitly:
//   Bo3 — 2-1 → 2-1, else 2-0
//   Bo5 — 3-1 and 3-2 → 2-1, else (3-0) 2-0
//   Bo7 — 4-2 and 4-3 → 2-1, else (4-0/4-1) 2-0
// A single formula reproduces all three and extrapolates to higher odd lengths:
//   threshold   = ceil(bestOf / 2)        (games needed to win the set)
//   creditFloor = floor(threshold / 2)    (loser games needed to be "competitive")
//   loser credited iff loserGames >= creditFloor
// (Bo3→floor(2/2)=1, Bo5→floor(3/2)=1, Bo7→floor(4/2)=2 — matches the table.)

export interface NormalizedSet {
  /** Winner's normalized games — always 2 by definition. */
  w: 2;
  /** Loser's normalized games — 1 if the set was competitive, else 0. */
  l: 0 | 1;
}

/** Games needed to win a best-of-`bestOf` set (assumes an odd length). */
export function setWinThreshold(bestOf: number): number {
  return Math.ceil(bestOf / 2);
}

/** Loser-games needed to be credited a normalized game (be "competitive"). */
export function competitiveFloor(bestOf: number): number {
  return Math.floor(setWinThreshold(bestOf) / 2);
}

/**
 * Collapse a finished set's loser-game count to Bo3 terms for the game
 * tiebreaker. The winner is always 2; only the loser's credit varies, so only
 * `loserGames` + `bestOf` are needed.
 */
export function normalizeSetToBo3(loserGames: number, bestOf: number): NormalizedSet {
  return { w: 2, l: loserGames >= competitiveFloor(bestOf) ? 1 : 0 };
}
