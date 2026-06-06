// EXPAND-phase backfill: convert the legacy Pairing + Shootout + MatchSession
// JSON into the unified relational Match / Game / Ban tables. Idempotent and
// re-runnable — Match reuses the source row's id, and Game/Ban upsert on their
// natural keys, so you can run it, eyeball the counts, and run it again.
//
// It only READS the legacy tables and WRITES the new ones — nothing legacy is
// modified or dropped, and the live MatchSession driver is untouched. Safe to
// run against prod with matches in flight (in-progress sessions simply have no
// completed game JSON yet, so they contribute no Game rows until they finish
// under the new writers).

import { prisma } from "@/lib/prisma";
import { recordAudit, type AuditActor } from "@/lib/audit";

interface GameStateMin {
  firstId?: string;
  pool?: Array<{ deck: string; stake: string }>;
  pickedDeckIdx?: number;
  dcByPlayerId?: string;
  bans?: number[];
  winnerId?: string;
  pickedRandomly?: boolean;
  firstBannedRandomly?: boolean;
  otherBannedRandomly?: boolean;
}

export interface BackfillResult {
  matchesFromPairings: number;
  matchesFromShootouts: number;
  gamesWritten: number;
  bansWritten: number;
  matchesWithoutGameData: number; // manual reports / in-flight — no game rows
}

function deriveWinner(
  playerAId: string,
  playerBId: string,
  gamesWonA: number,
  gamesWonB: number,
): string | null {
  if (gamesWonA > gamesWonB) return playerAId;
  if (gamesWonB > gamesWonA) return playerBId;
  return null;
}

// Project one stored GameState into a Game (+ its Bans). Returns how many
// rows were written. Bans use the same positional attribution the old
// bans[] array encoded: ordinal 0 = first player; 1..3 = the other player;
// 4..6 = first player again.
async function projectGame(
  matchId: string,
  num: number,
  playerAId: string,
  playerBId: string,
  json: string,
): Promise<{ games: number; bans: number }> {
  let g: GameStateMin;
  try {
    g = JSON.parse(json) as GameStateMin;
  } catch {
    return { games: 0, bans: 0 };
  }
  if (!g.firstId || !g.pool || g.pickedDeckIdx === undefined) return { games: 0, bans: 0 };
  const picked = g.pool[g.pickedDeckIdx];
  if (!picked) return { games: 0, bans: 0 };

  const firstId = g.firstId;
  const otherId = firstId === playerAId ? playerBId : playerAId;

  const game = await prisma.game.upsert({
    where: { matchId_num: { matchId, num } },
    create: {
      matchId,
      num,
      firstPlayerId: firstId,
      winnerId: g.winnerId ?? null,
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
      deck: picked.deck,
      stake: picked.stake,
      dcByPlayerId: g.dcByPlayerId ?? null,
      pickedRandomly: !!g.pickedRandomly,
      firstBannedRandomly: !!g.firstBannedRandomly,
      otherBannedRandomly: !!g.otherBannedRandomly,
    },
  });

  let bans = 0;
  const banIdxs = g.bans ?? [];
  for (let ordinal = 0; ordinal < banIdxs.length; ordinal++) {
    const idx = banIdxs[ordinal];
    if (idx === undefined) continue;
    const combo = g.pool[idx];
    if (!combo) continue;
    const playerId = ordinal === 0 || ordinal >= 4 ? firstId : otherId;
    await prisma.ban.upsert({
      where: { gameId_ordinal: { gameId: game.id, ordinal } },
      create: { gameId: game.id, ordinal, playerId, deck: combo.deck, stake: combo.stake },
      update: { playerId, deck: combo.deck, stake: combo.stake },
    });
    bans++;
  }
  return { games: 1, bans };
}

export async function backfillMatches(actor: AuditActor): Promise<BackfillResult> {
  const result: BackfillResult = {
    matchesFromPairings: 0,
    matchesFromShootouts: 0,
    gamesWritten: 0,
    bansWritten: 0,
    matchesWithoutGameData: 0,
  };

  // --- Pairings → Match(LEAGUE_BO2) (+ Games from the linked session) -------
  const pairings = await prisma.pairing.findMany();
  const sessions = await prisma.matchSession.findMany({
    where: { pairingId: { not: null } },
    select: { pairingId: true, game1: true, game2: true, game3: true },
  });
  const sessionByPairing = new Map(sessions.map((s) => [s.pairingId!, s]));

  for (const p of pairings) {
    const fields = {
      divisionId: p.divisionId,
      playerAId: p.playerAId,
      playerBId: p.playerBId,
      gamesWonA: p.gamesWonA,
      gamesWonB: p.gamesWonB,
      winnerId: deriveWinner(p.playerAId, p.playerBId, p.gamesWonA, p.gamesWonB),
      status: p.status,
      reporterId: p.reporterId,
      reportedAt: p.reportedAt,
      confirmedAt: p.confirmedAt,
      adminOverrideBy: p.adminOverrideBy,
      adminOverrideReason: p.adminOverrideReason,
      reportChannelId: p.reportChannelId,
      reportMessageId: p.reportMessageId,
      disputedById: p.disputedById,
      disputeProposedGamesWonA: p.disputeProposedGamesWonA,
      disputeProposedGamesWonB: p.disputeProposedGamesWonB,
      disputeReason: p.disputeReason,
      disputedAt: p.disputedAt,
      disputeThreadId: p.disputeThreadId,
      hadDc: p.hadDc,
      reportedDeck: p.reportedDeck,
      reportedStake: p.reportedStake,
    };
    await prisma.match.upsert({
      where: { id: p.id },
      create: { id: p.id, format: "LEAGUE_BO2", ...fields },
      update: { format: "LEAGUE_BO2", ...fields },
    });
    result.matchesFromPairings++;

    const sess = sessionByPairing.get(p.id);
    let wroteAnyGame = false;
    if (sess) {
      for (const [num, json] of [
        [1, sess.game1],
        [2, sess.game2],
        [3, sess.game3],
      ] as const) {
        if (!json) continue;
        const r = await projectGame(p.id, num, p.playerAId, p.playerBId, json);
        result.gamesWritten += r.games;
        result.bansWritten += r.bans;
        if (r.games) wroteAnyGame = true;
      }
    }
    if (!wroteAnyGame) result.matchesWithoutGameData++;
  }

  // --- Shootouts → Match(SHOOTOUT_BO1) (+ its single Game) ------------------
  const shootouts = await prisma.shootout.findMany();
  for (const s of shootouts) {
    const winA = s.winnerId === s.playerAId ? 1 : 0;
    const winB = s.winnerId === s.playerBId ? 1 : 0;
    const fields = {
      divisionId: s.divisionId,
      playerAId: s.playerAId,
      playerBId: s.playerBId,
      gamesWonA: winA,
      gamesWonB: winB,
      winnerId: s.winnerId,
      status: "CONFIRMED" as const,
      reportedAt: s.recordedAt,
      confirmedAt: s.recordedAt,
    };
    await prisma.match.upsert({
      where: { id: s.id },
      create: { id: s.id, format: "SHOOTOUT_BO1", ...fields },
      update: { format: "SHOOTOUT_BO1", ...fields },
    });
    result.matchesFromShootouts++;

    if (s.game) {
      const r = await projectGame(s.id, 1, s.playerAId, s.playerBId, s.game);
      result.gamesWritten += r.games;
      result.bansWritten += r.bans;
    } else {
      result.matchesWithoutGameData++;
    }
  }

  recordAudit({
    actor,
    action: "migrate.matches-backfill",
    targetType: "Match",
    targetId: "all",
    summary:
      `Backfilled ${result.matchesFromPairings} pairings + ${result.matchesFromShootouts} shootouts → ` +
      `${result.gamesWritten} games, ${result.bansWritten} bans`,
    metadata: { ...result },
  });

  return result;
}
