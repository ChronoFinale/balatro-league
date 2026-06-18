// "Elowen" — the league's hidden-MMR update, ported verbatim from the Balatro
// Multiplayer server's ranked formula (Botlatro-Multiplayer
// src/utils/algorithms/calculateMMR.ts, written by Owen). Reduced to the 1v1
// case the league uses.
//
// It IS Elo at the core: `1 / (1 + 10^((winner − loser)/variance))` is Elo's
// expected-score logistic, scaled by a fixed K (= 2·baseChange) and a
// games-played "volatility" multiplier that decays new players' swings from
// 1.75× down to 1.0× over their first `maxVolatility` games (a provisional-
// rating / decaying-K trick — NOT Glicko's RD math, despite the name).
//
// Behaviour (at settled volatility, gMultiplier = 1.0):
//   • even match     → change ≈ baseChange (17.5)
//   • underdog wins  → change → up to 2·baseChange (35)
//   • favourite wins → change → toward 0
// New players (volatility 0) swing 1.75× harder until they settle.

export interface ElowenConfig {
  // Base MMR change (server uses 17.5). Max swing is 2× this (35).
  baseChange: number;
  // Logistic scale — how much an MMR gap bends the curve (server uses 1200;
  // larger = flatter = gaps matter less). Tune to the league's MMR range.
  variance: number;
  // Games over which a new player's volatility climbs to settle their swing
  // from 1.75× to 1.0× (server caps at 15).
  maxVolatility: number;
}

export const ELOWEN_DEFAULTS: ElowenConfig = {
  baseChange: 17.5,
  variance: 1200,
  maxVolatility: 15,
};

export interface Rating {
  mmr: number;
  volatility: number;
}

export interface ElowenResult {
  winner: Rating;
  loser: Rating;
  // The (rounded) amount the winner gained / the loser lost (zero-sum in 1v1).
  change: number;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

// Apply one 1v1 result. `winner` beat `loser`. Returns both players' new
// ratings (mmr clamped 0..9999, volatility incremented and capped) plus the
// signed change. Pure — caller persists.
export function elowen1v1(
  winner: Rating,
  loser: Rating,
  cfg: ElowenConfig = ELOWEN_DEFAULTS,
): ElowenResult {
  // Server averages both sides' volatility into one global multiplier.
  const avgVolatility = (winner.volatility + loser.volatility) / 2;
  const gMultiplier = 1.75 - avgVolatility * 0.05;

  const numerator = 2 * cfg.baseChange;
  const exponent = (winner.mmr - loser.mmr) / cfg.variance;
  const denominator = 1 + Math.pow(10, exponent);
  const change = gMultiplier * (numerator / denominator);

  return {
    change: round1(change),
    winner: {
      mmr: clamp(round1(winner.mmr + change), 0, 9999),
      volatility: Math.min(winner.volatility + 1, cfg.maxVolatility),
    },
    loser: {
      mmr: clamp(round1(loser.mmr - change), 0, 9999),
      volatility: Math.min(loser.volatility + 1, cfg.maxVolatility),
    },
  };
}
