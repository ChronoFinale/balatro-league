// Deck/stake preset config + pool generation for /start-match.
// A MatchConfigPreset is the named set of decks + stakes admins curate.
// Each Season optionally picks a preset (Season.matchConfigPresetId);
// if a season hasn't picked one, /start-match falls back to the preset
// named "Default" (auto-created via seedDefaultPresetIfEmpty).

import { prisma } from "./db.js";
import defaults from "./data/match-defaults.json" with { type: "json" };

export const DEFAULT_POOL_SIZE = 9;
export const DEFAULT_PRESET_NAME = "Default";

export interface DeckEntry {
  deck: string;
  stake: string;
}

// Resolve which preset a season uses. Returns null if no preset is set AND
// no Default preset exists.
export async function presetForSeason(seasonId: string) {
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    include: { matchConfigPreset: true },
  });
  if (season?.matchConfigPreset) return season.matchConfigPreset;
  return prisma.matchConfigPreset.findUnique({ where: { name: DEFAULT_PRESET_NAME } });
}

// Same as presetForSeason, but starting from a division id (the join the
// match-buttons flow has on hand).
export async function presetForDivision(divisionId: string) {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { seasonId: true },
  });
  if (!division) return null;
  return presetForSeason(division.seasonId);
}

// Cartesian product of (deck × stake), shuffled and sliced. No duplicate combos.
export function generatePool(
  decks: string[],
  stakes: string[],
  size: number = DEFAULT_POOL_SIZE,
  rand: () => number = Math.random,
): DeckEntry[] {
  const combos: DeckEntry[] = [];
  for (const deck of decks) {
    for (const stake of stakes) {
      combos.push({ deck, stake });
    }
  }
  if (combos.length < size) return shuffle(combos, rand);
  return shuffle(combos, rand).slice(0, size);
}

function shuffle<T>(arr: T[], rand: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Auto-seed the Default preset with Balatro's stock decks/stakes if no
// presets exist yet. Called on first /start-match so admins can always run
// a match without first visiting the admin UI.
export async function seedDefaultPresetIfEmpty(): Promise<void> {
  const count = await prisma.matchConfigPreset.count();
  if (count > 0) return;
  await prisma.matchConfigPreset.create({
    data: {
      name: DEFAULT_PRESET_NAME,
      decks: defaults.decks,
      stakes: defaults.stakes,
    },
  });
}
