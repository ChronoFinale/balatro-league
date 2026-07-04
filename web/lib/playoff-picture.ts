// "What's at stake" analysis for a division: given the played matches and the
// remaining (unplayed) ones, work out who has CLINCHED / is CONTESTED / is
// ELIMINATED for promotion and relegation, and which remaining matches actually
// still matter vs are dead rubbers.
//
// Method: brute-force every combination of remaining outcomes (each match is a
// 2-0 / 1-1 / 0-2 → 3 branches) and, for each, compute the real standings via
// computeStandings (so points + head-to-head + wins/draws tiebreakers match the
// live table exactly). A player who lands in the promote set in EVERY scenario
// has clinched; in SOME but not all → contested; in NONE → eliminated.
//
// Cost is 3^(remaining), which shrinks fast as the season plays out. We prune
// "dead rubber" matches first (both players already locked by a cheap range
// check), so the exponent is usually small; a hard cap falls back to the range
// estimate for the rare early-season division that's still wide open.

import type { Player } from "@prisma/client";
import { DEFAULTS, type ScoringConfig } from "@/lib/league-settings";
import { computeStandings } from "@/lib/standings";

export interface PPPlayer {
  id: string;
  displayName: string;
}
export interface PPPairing {
  playerAId: string;
  playerBId: string;
  gamesWonA: number;
  gamesWonB: number;
}
export interface PPRemaining {
  playerAId: string;
  playerBId: string;
}

export type PromoStatus = "clinched" | "contested" | "eliminated" | "n/a";
export type RelegStatus = "clinched" | "contested" | "safe" | "n/a";

export interface PPPlayerResult {
  playerId: string;
  displayName: string;
  pointsNow: number;
  pointsMax: number; // win every remaining match
  pointsMin: number; // lose every remaining match
  remainingCount: number;
  promo: PromoStatus;
  releg: RelegStatus;
  couldTieBoundary: boolean; // some scenario ends in a real tie at a cutoff (shootout territory)
}

export type MatchImportance = "promotion" | "relegation" | "influences" | "dead-rubber";
export interface PPMatchResult {
  playerAId: string;
  playerAName: string;
  playerBId: string;
  playerBName: string;
  importance: MatchImportance;
  note: string;
}

export interface PlayoffPicture {
  promote: number;
  relegate: number;
  players: PPPlayerResult[]; // current-standings order
  matches: PPMatchResult[];
  exact: boolean; // false = too many open matches, fell back to the range estimate
  scenarioCount: number;
  variableMatches: number;
}

const OUTCOMES: Array<[number, number]> = [
  [2, 0],
  [1, 1],
  [0, 2],
];
const WIN = 3;

// computeStandings only reads id + displayName off each player.
const asPlayers = (ps: PPPlayer[]): Player[] => ps as unknown as Player[];
const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);

export function computePlayoffPicture(input: {
  players: PPPlayer[];
  played: PPPairing[];
  remaining: PPRemaining[];
  promote: number;
  relegate: number;
  scoring?: ScoringConfig;
  maxScenarios?: number;
}): PlayoffPicture {
  const scoring = input.scoring ?? DEFAULTS.scoring;
  // ~3^12 solves in well under a second; beyond that (a still-wide-open division)
  // we fall back to the range estimate so a multi-division page never grinds.
  const maxScenarios = input.maxScenarios ?? 1_000_000;
  const players = input.players;
  const n = players.length;
  const promote = Math.max(0, Math.min(input.promote, n));
  const relegate = Math.max(0, Math.min(input.relegate, n));
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));

  // Current standings + per-player points range.
  const now = computeStandings(asPlayers(players), input.played, [], scoring);
  const orderIndex = new Map(now.map((r, i) => [r.player.id, i]));
  const pointsNow = new Map(now.map((r) => [r.player.id, r.points]));
  const remainingCount = new Map<string, number>(players.map((p) => [p.id, 0]));
  for (const m of input.remaining) {
    remainingCount.set(m.playerAId, (remainingCount.get(m.playerAId) ?? 0) + 1);
    remainingCount.set(m.playerBId, (remainingCount.get(m.playerBId) ?? 0) + 1);
  }
  const range = new Map<string, { min: number; max: number }>();
  for (const p of players) {
    const base = pointsNow.get(p.id) ?? 0;
    range.set(p.id, { min: base, max: base + WIN * (remainingCount.get(p.id) ?? 0) });
  }

  // Cheap RANGE-based clinch (sound/conservative) — used to prune dead rubbers
  // and as the fallback if there are too many open matches to enumerate.
  const rangePromo = new Map<string, PromoStatus>();
  const rangeReleg = new Map<string, RelegStatus>();
  for (const p of players) {
    const me = range.get(p.id)!;
    if (promote === 0) rangePromo.set(p.id, "n/a");
    else {
      const canBeAtOrAbove = players.filter((q) => q.id !== p.id && range.get(q.id)!.max >= me.min).length;
      const guaranteedAbove = players.filter((q) => q.id !== p.id && range.get(q.id)!.min > me.max).length;
      rangePromo.set(p.id, canBeAtOrAbove < promote ? "clinched" : guaranteedAbove >= promote ? "eliminated" : "contested");
    }
    if (relegate === 0) rangeReleg.set(p.id, "n/a");
    else {
      const guaranteedBelow = players.filter((q) => q.id !== p.id && range.get(q.id)!.max < me.min).length;
      const guaranteedAbove = players.filter((q) => q.id !== p.id && range.get(q.id)!.min > me.max).length;
      rangeReleg.set(p.id, guaranteedBelow >= relegate ? "safe" : guaranteedAbove >= n - relegate ? "clinched" : "contested");
    }
  }
  const fullyLocked = (id: string) =>
    (rangePromo.get(id) === "clinched" || rangeReleg.get(id) === "clinched") &&
    rangePromo.get(id) !== "contested" &&
    rangeReleg.get(id) !== "contested";

  // A remaining match is a dead rubber iff BOTH players are already locked into a
  // destination — their result then moves no boundary. Everything else is variable.
  const variable: PPRemaining[] = [];
  const dead: PPRemaining[] = [];
  for (const m of input.remaining) {
    if (fullyLocked(m.playerAId) && fullyLocked(m.playerBId)) dead.push(m);
    else variable.push(m);
  }

  const scenarioCount = 3 ** variable.length;
  const exact = scenarioCount <= maxScenarios;

  let promo = rangePromo;
  let releg = rangeReleg;
  const couldTie = new Set<string>();

  if (exact && variable.length > 0) {
    // Base pairings that never change: played + dead rubbers pinned to 1-1 (their
    // result can't move any boundary, so any fixed value is sound).
    const base: PPPairing[] = [
      ...input.played,
      ...dead.map((m) => ({ playerAId: m.playerAId, playerBId: m.playerBId, gamesWonA: 1, gamesWonB: 1 })),
    ];
    // Reused array — mutate the trailing variable slots per scenario, no realloc.
    const slots: PPPairing[] = variable.map((m) => ({ playerAId: m.playerAId, playerBId: m.playerBId, gamesWonA: 0, gamesWonB: 0 }));
    const pairings = [...base, ...slots];

    const everPromo = new Set<string>();
    const alwaysPromo = new Set(players.map((p) => p.id));
    const everReleg = new Set<string>();
    const alwaysReleg = new Set(players.map((p) => p.id));

    const V = variable.length;
    for (let k = 0; k < scenarioCount; k++) {
      let x = k;
      for (let i = 0; i < V; i++) {
        const [ga, gb] = OUTCOMES[x % 3]!;
        slots[i]!.gamesWonA = ga;
        slots[i]!.gamesWonB = gb;
        x = Math.floor(x / 3);
      }
      const rows = computeStandings(asPlayers(players), pairings, [], scoring);
      const promoted = new Set<string>();
      const relegated = new Set<string>();
      for (let i = 0; i < promote; i++) promoted.add(rows[i]!.player.id);
      for (let i = 0; i < relegate; i++) relegated.add(rows[n - 1 - i]!.player.id);
      // Real tie sitting on a cutoff = shootout territory.
      if (promote > 0 && promote < n && rows[promote]!.tiedWithPrev) {
        couldTie.add(rows[promote]!.player.id);
        couldTie.add(rows[promote - 1]!.player.id);
      }
      if (relegate > 0 && relegate < n && rows[n - relegate]!.tiedWithPrev) {
        couldTie.add(rows[n - relegate]!.player.id);
        couldTie.add(rows[n - relegate - 1]!.player.id);
      }
      for (const p of players) {
        if (promoted.has(p.id)) everPromo.add(p.id);
        else alwaysPromo.delete(p.id);
        if (relegated.has(p.id)) everReleg.add(p.id);
        else alwaysReleg.delete(p.id);
      }
    }

    promo = new Map(
      players.map((p) => {
        if (promote === 0) return [p.id, "n/a" as PromoStatus];
        if (alwaysPromo.has(p.id)) return [p.id, "clinched"];
        if (everPromo.has(p.id)) return [p.id, "contested"];
        return [p.id, "eliminated"];
      }),
    );
    releg = new Map(
      players.map((p) => {
        if (relegate === 0) return [p.id, "n/a" as RelegStatus];
        if (alwaysReleg.has(p.id)) return [p.id, "clinched"];
        if (everReleg.has(p.id)) return [p.id, "contested"];
        return [p.id, "safe"];
      }),
    );
  }

  const playerResults: PPPlayerResult[] = players
    .map((p) => ({
      playerId: p.id,
      displayName: p.displayName,
      pointsNow: pointsNow.get(p.id) ?? 0,
      pointsMax: range.get(p.id)!.max,
      pointsMin: range.get(p.id)!.min,
      remainingCount: remainingCount.get(p.id) ?? 0,
      promo: promo.get(p.id) ?? "n/a",
      releg: releg.get(p.id) ?? "n/a",
      couldTieBoundary: couldTie.has(p.id),
    }))
    .sort((a, b) => (orderIndex.get(a.playerId) ?? 0) - (orderIndex.get(b.playerId) ?? 0));

  const deadSet = new Set(dead.map((m) => pairKey(m.playerAId, m.playerBId)));
  const contestedPromo = (id: string) => promo.get(id) === "contested";
  const contestedReleg = (id: string) => releg.get(id) === "contested";
  const matches: PPMatchResult[] = input.remaining.map((m) => {
    const a = m.playerAId;
    const b = m.playerBId;
    let importance: MatchImportance;
    let note: string;
    if (deadSet.has(pairKey(a, b))) {
      importance = "dead-rubber";
      note = "Both players already decided.";
    } else if (contestedPromo(a) && contestedPromo(b)) {
      importance = "promotion";
      note = "Both still fighting for a promotion spot.";
    } else if (contestedReleg(a) && contestedReleg(b)) {
      importance = "relegation";
      note = "Both still fighting to avoid the drop.";
    } else if (contestedPromo(a) || contestedPromo(b) || contestedReleg(a) || contestedReleg(b)) {
      importance = "influences";
      const who = [a, b].filter((id) => contestedPromo(id) || contestedReleg(id)).map((id) => nameOf.get(id) ?? id);
      note = `Affects ${who.join(" & ")}'s race.`;
    } else {
      importance = "dead-rubber";
      note = "Neither player is in contention.";
    }
    return {
      playerAId: a,
      playerAName: nameOf.get(a) ?? a,
      playerBId: b,
      playerBName: nameOf.get(b) ?? b,
      importance,
      note,
    };
  });

  // Order matches: promotion → relegation → influences → dead rubbers.
  const rank: Record<MatchImportance, number> = { promotion: 0, relegation: 1, influences: 2, "dead-rubber": 3 };
  matches.sort((a, b) => rank[a.importance] - rank[b.importance]);

  return {
    promote,
    relegate,
    players: playerResults,
    matches,
    exact,
    scenarioCount,
    variableMatches: variable.length,
  };
}
