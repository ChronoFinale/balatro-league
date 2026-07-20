// Balatro Multiplayer rank tiers - port of Balatro-Multiplayer/www src/shared/ranks.ts
// ("season-aware rank thresholds"), kept in sync with the same port in the Team Tour
// (packages/tour-core/src/balatro-ranks.ts in bmp-colosseum/balatro-team-tour).
//
// WHY this exists: balatromp's tRPC API returns MMR + leaderboard rank but NOT the tier.
// The site COMPUTES the tier client-side from MMR, and the cutoffs shifted by +300 at
// season 7. So the tier is only meaningful RELATIVE TO ITS SEASON - a season-6 "Glass"
// player and a season-7 "Gold" player sit at nearly the same raw MMR. Computing it with
// one flat table (what this repo did before) mislabels every season-7 snapshot.
//
// Two independent axes combine into a full tier:
//   - ENHANCEMENT (from MMR, per-season cutoffs): Stone < Steel < Gold < Lucky < Glass
//   - EDITION overlay (from leaderboard rank, season-independent): Foil top50 <
//     Holographic top10 < Polychrome top3 < Negative #1. Null outside the top 50.

export type EnhancementTier = "Stone" | "Steel" | "Gold" | "Lucky" | "Glass";
export type EditionTier = "Foil" | "Holographic" | "Polychrome" | "Negative";

export interface EnhancementThresholds {
  STEEL: number;
  GOLD: number;
  LUCKY: number;
  GLASS: number;
}

// Seasons 1-6 (before the +300 bump).
export const OLD_ENHANCEMENT: EnhancementThresholds = { STEEL: 230, GOLD: 320, LUCKY: 460, GLASS: 620 };
// Season 7 onward (+300 bump) - also the default for any unmapped/future season.
export const NEW_ENHANCEMENT: EnhancementThresholds = { STEEL: 530, GOLD: 620, LUCKY: 760, GLASS: 920 };

// Leaderboard-rank cutoffs for the edition overlay (top-N of that season's leaderboard).
export const EDITION_RANK = { FOIL: 50, HOLOGRAPHIC: 10, POLYCHROME: 3, NEGATIVE: 1 } as const;

// Parse a Balatro season identifier ("season6", "Season 6", 6) to its number, else undefined.
// undefined means "unknown / current", which resolves to the default (new) thresholds.
export function resolveBalatroSeason(season?: string | number | null): number | undefined {
  if (season == null) return undefined;
  if (typeof season === "number") return Number.isInteger(season) ? season : undefined;
  const m = /(\d+)/.exec(season);
  return m ? Number(m[1]) : undefined;
}

// The enhancement cutoffs in force for a season: OLD for 1-6, NEW for 7+ and anything unknown.
export function enhancementThresholds(season?: string | number | null): EnhancementThresholds {
  const n = resolveBalatroSeason(season);
  return n !== undefined && n <= 6 ? OLD_ENHANCEMENT : NEW_ENHANCEMENT;
}

// MMR -> enhancement tier for a given season.
export function enhancementTier(mmr: number, season?: string | number | null): EnhancementTier {
  const t = enhancementThresholds(season);
  if (mmr >= t.GLASS) return "Glass";
  if (mmr >= t.LUCKY) return "Lucky";
  if (mmr >= t.GOLD) return "Gold";
  if (mmr >= t.STEEL) return "Steel";
  return "Stone";
}

// Leaderboard rank -> edition tier (null outside the top 50, or when rank is unknown).
export function editionTier(rank?: number | null): EditionTier | null {
  if (rank == null || rank < 1) return null;
  if (rank <= EDITION_RANK.NEGATIVE) return "Negative";
  if (rank <= EDITION_RANK.POLYCHROME) return "Polychrome";
  if (rank <= EDITION_RANK.HOLOGRAPHIC) return "Holographic";
  if (rank <= EDITION_RANK.FOIL) return "Foil";
  return null;
}
