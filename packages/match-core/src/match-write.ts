// Writers for the unified Match model's Game + GameDeck rows, ported from the
// league's src/match-write.ts. The one change for the shared core: the Prisma
// client is INJECTED rather than imported. match-core has no generated client of
// its own (its schema is a fragment merged into each app), so each app passes
// its own client. Any client whose `game.upsert` / `gameDeck.upsert` accept the
// shapes below satisfies `MatchWriteClient` structurally — the real generated
// PrismaClient does.
//
// A Game carries the picked deck/stake + flags; its GameDeck rows are the FULL
// pool (one per combo) with picked/ban attribution, so deck/stake stats are
// exact SQL aggregates. Idempotent: upserts on (matchId,num) and (gameId,poolIdx).

import { DEFAULT_POLICY, banOwner, type BanPickPolicy } from "./match-state";

// The slice of a game state we persist. A full `GameState` satisfies this.
export interface MatchGameInput {
  firstId?: string;
  pool?: Array<{ deck: string; stake: string }>;
  pickedDeckIdx?: number;
  dcByPlayerId?: string;
  bans?: number[];
  winnerId?: string;
  winnerLives?: number;
  pickedRandomly?: boolean;
  firstBannedRandomly?: boolean;
  otherBannedRandomly?: boolean;
}

// --- injected client surface -------------------------------------------------
// Only the two upsert calls writeMatchGame makes. Field shapes mirror the core
// Game / GameDeck models. Return types are narrowed to what we consume.

interface GameUpsertData {
  matchId: string;
  num: number;
  firstPlayerId: string;
  winnerId: string | null;
  winnerLives: number | null;
  deck: string;
  stake: string;
  dcByPlayerId: string | null;
  pickedRandomly: boolean;
  firstBannedRandomly: boolean;
  otherBannedRandomly: boolean;
}

interface GameDeckUpsertData {
  gameId: string;
  poolIdx: number;
  deck: string;
  stake: string;
  picked: boolean;
  banOrdinal: number | null;
  bannedById: string | null;
}

export interface MatchWriteClient {
  game: {
    upsert(args: {
      where: { matchId_num: { matchId: string; num: number } };
      create: GameUpsertData;
      update: Omit<GameUpsertData, "matchId" | "num">;
    }): Promise<{ id: string }>;
  };
  gameDeck: {
    upsert(args: {
      where: { gameId_poolIdx: { gameId: string; poolIdx: number } };
      create: GameDeckUpsertData;
      update: Omit<GameDeckUpsertData, "gameId" | "poolIdx">;
    }): Promise<unknown>;
  };
}

// Write one game (+ its pool) onto a match. playerA/B are the match's canonical
// players, used to attribute bans. No-op (returns false) if the game has no real
// pool/pick yet.
export async function writeMatchGame(
  client: MatchWriteClient,
  matchId: string,
  num: number,
  playerAId: string,
  playerBId: string,
  g: MatchGameInput,
  policy: BanPickPolicy = DEFAULT_POLICY,
): Promise<boolean> {
  if (!g.firstId || !g.pool || g.pickedDeckIdx === undefined) return false;
  const picked = g.pool[g.pickedDeckIdx];
  if (!picked) return false;

  const firstId = g.firstId;
  const otherId = firstId === playerAId ? playerBId : playerAId;

  const game = await client.game.upsert({
    where: { matchId_num: { matchId, num } },
    create: {
      matchId,
      num,
      firstPlayerId: firstId,
      winnerId: g.winnerId ?? null,
      winnerLives: g.winnerLives ?? null,
      deck: picked.deck,
      stake: picked.stake,
      dcByPlayerId: g.dcByPlayerId ?? null,
      pickedRandomly: !!g.pickedRandomly,
      firstBannedRandomly: !!g.firstBannedRandomly,
      otherBannedRandomly: !!g.otherBannedRandomly,
    },
    update: {
      firstPlayerId: firstId,
      winnerId: g.winnerId ?? null,
      winnerLives: g.winnerLives ?? null,
      deck: picked.deck,
      stake: picked.stake,
      dcByPlayerId: g.dcByPlayerId ?? null,
      pickedRandomly: !!g.pickedRandomly,
      firstBannedRandomly: !!g.firstBannedRandomly,
      otherBannedRandomly: !!g.otherBannedRandomly,
    },
  });

  const banOrdinalByPoolIdx = new Map<number, number>();
  (g.bans ?? []).forEach((poolIdx, ordinal) => {
    if (poolIdx !== undefined) banOrdinalByPoolIdx.set(poolIdx, ordinal);
  });
  for (let poolIdx = 0; poolIdx < g.pool.length; poolIdx++) {
    const combo = g.pool[poolIdx];
    if (!combo) continue;
    const banOrdinal = banOrdinalByPoolIdx.get(poolIdx);
    const bannedById =
      banOrdinal === undefined ? null : banOwner(banOrdinal, firstId, otherId, policy);
    await client.gameDeck.upsert({
      where: { gameId_poolIdx: { gameId: game.id, poolIdx } },
      create: {
        gameId: game.id,
        poolIdx,
        deck: combo.deck,
        stake: combo.stake,
        picked: poolIdx === g.pickedDeckIdx,
        banOrdinal: banOrdinal ?? null,
        bannedById,
      },
      update: {
        deck: combo.deck,
        stake: combo.stake,
        picked: poolIdx === g.pickedDeckIdx,
        banOrdinal: banOrdinal ?? null,
        bannedById,
      },
    });
  }
  return true;
}

// Write a series' games (Bo2/Bo3/Bo5) onto a match from its per-game states.
export async function writeMatchGames(
  client: MatchWriteClient,
  matchId: string,
  playerAId: string,
  playerBId: string,
  games: Array<MatchGameInput | null | undefined>,
  policy: BanPickPolicy = DEFAULT_POLICY,
): Promise<void> {
  for (let i = 0; i < games.length; i++) {
    const g = games[i];
    if (g) await writeMatchGame(client, matchId, i + 1, playerAId, playerBId, g, policy);
  }
}
