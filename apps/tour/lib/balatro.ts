// Canonical Balatro deck + stake names (mirrors the league's src/data/balatro-info.json).
// Used for the per-game result-capture dropdowns and deck/stake stats. Kept as a flat
// name list here — the Tour only needs the names; art/descriptions live elsewhere.
export const DECKS = [
  "Red", "Blue", "Yellow", "Green", "Black", "Magic", "Nebula", "Ghost", "Abandoned",
  "Checkered", "Zodiac", "Painted", "Anaglyph", "Plasma", "Erratic", "Cocktail",
  "Gradient", "Heidelberg", "Indigo", "Orange", "Oracle", "Violet",
] as const;

export const STAKES = [
  "White", "Red", "Green", "Black", "Blue", "Purple", "Orange", "Gold", "Planet",
  "Spectral", "Spectral+",
] as const;

export type Deck = (typeof DECKS)[number];
export type Stake = (typeof STAKES)[number];

const deckSet = new Set<string>(DECKS);
const stakeSet = new Set<string>(STAKES);
export const isDeck = (v: string) => deckSet.has(v);
export const isStake = (v: string) => stakeSet.has(v);
