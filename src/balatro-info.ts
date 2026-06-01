// Canonical Balatro deck/stake list with effect descriptions. Hard-coded
// (vs DB-stored) because the list is game-truthy + curated by the league
// staff for which mod decks they're allowing, not a per-instance config.
// Update by editing src/data/balatro-info.json and redeploying.
//
// Match-flow UI looks up descriptions to render under each ban-menu option
// and inside the pick-step embed. Deck/stake preset editor populates its
// 'Add' dropdowns from this list so admin can't typo a name into existence.

import info from "./data/balatro-info.json" with { type: "json" };

export interface BalatroItem {
  name: string;
  description: string;
}

export const CANONICAL_DECKS: readonly BalatroItem[] = info.decks;
export const CANONICAL_STAKES: readonly BalatroItem[] = info.stakes;

const deckByName = new Map(CANONICAL_DECKS.map((d) => [d.name.toLowerCase(), d]));
const stakeByName = new Map(CANONICAL_STAKES.map((s) => [s.name.toLowerCase(), s]));

export function deckDescription(name: string): string | undefined {
  return deckByName.get(name.toLowerCase())?.description;
}

export function stakeDescription(name: string): string | undefined {
  return stakeByName.get(name.toLowerCase())?.description;
}

export function isCanonicalDeck(name: string): boolean {
  return deckByName.has(name.toLowerCase());
}

export function isCanonicalStake(name: string): boolean {
  return stakeByName.has(name.toLowerCase());
}
