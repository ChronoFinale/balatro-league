// Deck + stake stats — pure reductions over captured Game rows (deck/stake/winner
// per game, logged at report time). Empty until live seasons capture game detail;
// lights up as it accumulates. Win% is by the game's winner vs the deck played.
import { prisma } from "./db";

export interface DeckRow {
  name: string;
  games: number;
  wins: number;
  winPct: number;
}

async function tally(field: "deck" | "stake"): Promise<DeckRow[]> {
  const games = await prisma.game.findMany({ select: { deck: true, stake: true, winnerId: true, firstPlayerId: true, matchId: true } });
  if (games.length === 0) return [];
  // A game row records ONE deck/stake (the combo played) + the winner. We can't
  // always attribute the deck to a specific side, so "win" = the game had a winner
  // and the deck/stake is what was played — i.e. play-rate + how often that combo's
  // game was decisive. (Per-side deck attribution needs the full pool; see ban/pick.)
  const acc = new Map<string, { games: number; wins: number }>();
  for (const g of games) {
    const key = field === "deck" ? g.deck : g.stake;
    if (!key) continue;
    const a = acc.get(key) ?? { games: 0, wins: 0 };
    a.games++;
    if (g.winnerId) a.wins++;
    acc.set(key, a);
  }
  return [...acc.entries()]
    .map(([name, a]) => ({ name, games: a.games, wins: a.wins, winPct: a.games ? a.wins / a.games : 0 }))
    .sort((x, y) => y.games - x.games || x.name.localeCompare(y.name));
}

export async function getDeckStats(): Promise<{ decks: DeckRow[]; stakes: DeckRow[]; totalGames: number }> {
  const [decks, stakes, totalGames] = await Promise.all([tally("deck"), tally("stake"), prisma.game.count()]);
  return { decks, stakes, totalGames };
}
