// Core of the match-data seed, factored out so both the CLI
// (scripts/seed-test-matches.ts) and the end-to-end runner
// (scripts/seed-e2e.ts) drive the SAME fabrication logic.
//
// Fabricates realistic COMPLETED matches for a built season so the stats
// pages (most-banned decks, deck usage/win-rate, DCs, shootouts) and the
// profile traits have data to show. Mirrors how the real flow stores
// results: a CONFIRMED Pairing plus a linked MatchSession whose
// game1/game2(/game3) JSON carries the ban/pick GameState the loaders read.
//
// For each division it round-robins the members, plays ~most pairs, and
// for each played pair generates per-game state following the real ban
// policy (pool of 9 → 7 bans → 2 remain → 1 picked). A slice of games are
// disconnect-forfeits (dcByPlayerId set + hadDc on the Pairing), some use
// the 🎲 random buttons (so the Rando Brando trait can surface), and a few
// drawn pairs also get a Shootout row. Deterministic (seeded RNG).

import { MatchSessionState } from "@prisma/client";
import { prisma } from "./db.js";
import { generatePool, presetForSeason } from "./match-config.js";
import { recomputeDivisionStandings } from "./standings-cache.js";
import defaults from "./data/match-defaults.json" with { type: "json" };
import type { GameState } from "./match-session.js";
import type { DeckEntry } from "./match-config.js";

const POOL_SIZE = 9;
const TOTAL_BANS = 7; // 1 (first) + 3 (second) + 3 (first) → 2 remain, second picks 1
// How many match writes to have in flight at once. Bounded so a big
// multi-season run doesn't exhaust the Prisma connection pool.
const WRITE_CONCURRENCY = 12;

interface PreparedMatch {
  divisionId: string;
  pA: string;
  pB: string;
  canonA: string;
  canonB: string;
  games: GameState[];
  winsA: number;
  winsB: number;
  hadDc: boolean;
  playedAt: Date;
  shootoutWinnerId: string | null;
}

// Run `fn` over `items` with at most `limit` promises in flight. Workers
// pull from a shared cursor until the list is drained.
async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<unknown>,
): Promise<void> {
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const i = cursor++;
      await fn(items[i]!);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
}

export interface SeedMatchesOptions {
  // Pick the target season by id (preferred), by number, or fall back to
  // the active season when neither is given.
  seasonId?: string | null;
  seasonNumber?: number | null;
  reset?: boolean;
  playFraction?: number; // 0..1, default 0.8
}

export interface SeedMatchesResult {
  seasonLabel: string;
  divisionCount: number;
  pairingsMade: number;
  gamesMade: number;
  dcGames: number;
  shootoutsMade: number;
}

// Deterministic PRNG (FNV-1a seed → mulberry32) so seeds are reproducible.
function makeRng(seedStr: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

// Build one game's GameState following the real ban policy. A DC game
// still carries bans/pick (the ban phase happened, then someone dropped),
// plus dcByPlayerId. ~20%/flag of games use a 🎲 random button so the
// Rando Brando trait has signal.
function generateGame(
  rng: () => number,
  pool: DeckEntry[],
  firstId: string,
  winnerId: string,
  dcByPlayerId?: string,
): GameState {
  const order = shuffle(
    Array.from({ length: pool.length }, (_, i) => i),
    rng,
  );
  const bans = order.slice(0, TOTAL_BANS).sort((x, y) => x - y);
  const remaining = order.slice(TOTAL_BANS);
  const pickedDeckIdx = remaining[Math.floor(rng() * remaining.length)]!;
  const game: GameState = { firstId, bans, pickedDeckIdx, winnerId, pool };
  if (dcByPlayerId) game.dcByPlayerId = dcByPlayerId;
  if (rng() < 0.2) game.pickedRandomly = true;
  if (rng() < 0.2) game.firstBannedRandomly = true;
  if (rng() < 0.2) game.otherBannedRandomly = true;
  return game;
}

export async function seedTestMatches(opts: SeedMatchesOptions): Promise<SeedMatchesResult> {
  const playFraction = opts.playFraction != null ? Math.min(1, Math.max(0, opts.playFraction)) : 0.8;

  const season = opts.seasonId
    ? await prisma.season.findUnique({ where: { id: opts.seasonId } })
    : opts.seasonNumber != null
      ? await prisma.season.findFirst({ where: { number: opts.seasonNumber } })
      : await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) {
    throw new Error(
      opts.seasonId
        ? `No season ${opts.seasonId}.`
        : opts.seasonNumber != null
          ? `No season #${opts.seasonNumber}.`
          : "No active season.",
    );
  }

  const divisions = await prisma.division.findMany({
    where: { seasonId: season.id },
    include: { members: { where: { status: "ACTIVE" }, select: { playerId: true } } },
  });
  if (divisions.length === 0) {
    throw new Error("That season has no divisions yet — build it from signups first.");
  }

  if (opts.reset) {
    const divIds = divisions.map((d) => d.id);
    await prisma.matchSession.deleteMany({ where: { divisionId: { in: divIds } } });
    await prisma.pairing.deleteMany({ where: { divisionId: { in: divIds } } });
    await prisma.shootout.deleteMany({ where: { divisionId: { in: divIds } } });
  }

  // Deck/stake pool source: the season's preset, else the canonical defaults.
  const preset = await presetForSeason(season.id);
  const decks = preset?.decks?.length ? preset.decks : defaults.decks;
  const stakes = preset?.stakes?.length ? preset.stakes : defaults.stakes;

  // Phase A — deterministic, in-memory: consume the RNG in a fixed order
  // (per division) to fabricate every played pair's game state. Keeping all
  // RNG draws here (no DB awaits interleaved) means the parallel write phase
  // below can't perturb determinism: same seed → same data, every run.
  const baseTime = (season.startedAt ?? new Date()).getTime();
  let dcGames = 0;
  const prepared: PreparedMatch[] = [];

  for (const division of divisions) {
    const memberIds = division.members.map((m) => m.playerId);
    const rng = makeRng(`matches:${season.id}:${division.id}`);

    for (let i = 0; i < memberIds.length; i++) {
      for (let j = i + 1; j < memberIds.length; j++) {
        if (rng() > playFraction) continue; // leave some pairs unplayed
        const pA = memberIds[i]!;
        const pB = memberIds[j]!;
        const [canonA, canonB] = pA < pB ? [pA, pB] : [pB, pA];

        const games: GameState[] = [];
        let winsA = 0;
        let winsB = 0;
        for (let g = 0; g < 2; g++) {
          const firstId = rng() < 0.5 ? pA : pB;
          const winnerId = rng() < 0.5 ? pA : pB;
          const isDc = rng() < 0.15;
          const dcByPlayerId = isDc ? (winnerId === pA ? pB : pA) : undefined;
          const game = generateGame(rng, generatePool(decks, stakes, POOL_SIZE, rng), firstId, winnerId, dcByPlayerId);
          games.push(game);
          if (isDc) dcGames++;
          if (winnerId === canonA) winsA++;
          else winsB++;
        }
        const hadDc = games.some((g) => g.dcByPlayerId);
        const playedAt = new Date(baseTime + Math.floor(rng() * 20) * 86400000);

        let shootoutWinnerId: string | null = null;
        if (winsA === 1 && winsB === 1 && rng() < 0.5) {
          shootoutWinnerId = rng() < 0.5 ? canonA : canonB;
        }

        prepared.push({
          divisionId: division.id,
          pA,
          pB,
          canonA,
          canonB,
          games,
          winsA,
          winsB,
          hadDc,
          playedAt,
          shootoutWinnerId,
        });
      }
    }
  }

  // Phase B — parallel writes. Each prepared match is an independent
  // pairing(+session+shootout) triple, so we fan them out with a bounded
  // concurrency (keeps the Prisma connection pool from being swamped).
  // Pairing is created first so the session can link pairingId on create —
  // no second UPDATE round-trip.
  const shootoutsMade = prepared.filter((p) => p.shootoutWinnerId).length;
  await runWithConcurrency(prepared, WRITE_CONCURRENCY, async (p) => {
    const pairing = await prisma.pairing.create({
      data: {
        divisionId: p.divisionId,
        playerAId: p.canonA,
        playerBId: p.canonB,
        gamesWonA: p.winsA,
        gamesWonB: p.winsB,
        status: "CONFIRMED",
        reporterId: p.canonA,
        reportedAt: p.playedAt,
        confirmedAt: p.playedAt,
        hadDc: p.hadDc,
      },
    });
    await prisma.matchSession.create({
      data: {
        divisionId: p.divisionId,
        playerAId: p.pA,
        playerBId: p.pB,
        state: MatchSessionState.COMPLETE,
        bestOf: 2,
        game1: JSON.stringify(p.games[0]),
        game2: JSON.stringify(p.games[1]),
        completedAt: p.playedAt,
        pairingId: pairing.id,
      },
    });
    if (p.shootoutWinnerId) {
      await prisma.shootout.create({
        data: {
          divisionId: p.divisionId,
          playerAId: p.canonA,
          playerBId: p.canonB,
          winnerId: p.shootoutWinnerId,
          recordedBy: "seed-test-matches",
        },
      });
    }
  });
  const pairingsMade = prepared.length;
  const gamesMade = prepared.length * 2;

  // Phase C — recompute the standings CACHE for every division (the
  // standings page reads the cache; it only refreshes on result writes).
  // Independent per division, so run them concurrently too.
  await runWithConcurrency(divisions, WRITE_CONCURRENCY, (d) => recomputeDivisionStandings(d.id));

  const seasonLabel = season.subtitle
    ? `Season ${season.number} — ${season.subtitle}`
    : `Season ${season.number}`;

  return { seasonLabel, divisionCount: divisions.length, pairingsMade, gamesMade, dcGames, shootoutsMade };
}
