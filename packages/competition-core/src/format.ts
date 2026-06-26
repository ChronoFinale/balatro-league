// Formats — strategies that turn participants into fixtures (the STRUCTURE of who
// plays whom, when). Generic; the host tags fixtures and maps them to its own
// week/matchup entities.
//
//   League  divisions  = groupStage (round-robin per division, 2 legs)
//   Tour    regular     = groupStage (round-robin per conference) + special weeks
//   Tour    playoffs    = standardBracketPairings → advanceWinners (single-elim)

import type { Fixture, Participant } from "./types";

const BYE = "__BYE__";

// Circle-method single round-robin → rounds of [a, b] pairs (byes dropped).
export function roundRobinPairs(ids: readonly string[]): [string, string][][] {
  if (ids.length < 2) return [];
  const arr = [...ids];
  if (arr.length % 2 === 1) arr.push(BYE);
  const n = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < n / 2; i++) {
      const t1 = arr[i]!;
      const t2 = arr[n - 1 - i]!;
      if (t1 !== BYE && t2 !== BYE) pairs.push([t1, t2]);
    }
    rounds.push(pairs);
    const fixed = arr[0]!;
    const rest = arr.slice(1);
    rest.unshift(rest.pop()!);
    arr.splice(0, arr.length, fixed, ...rest);
  }
  return rounds;
}

export interface RoundRobinOpts {
  legs?: number; // 1 = single, 2 = home/away double (League). Default 1.
  startRound?: number; // 1-based round to start numbering at. Default 1.
  kind?: string; // fixture tag. Default "ROUND_ROBIN".
}

// Round-robin for one pool of participants → fixtures. All participants are
// assumed to share a group (carried onto the fixtures).
export function roundRobin(participants: readonly Participant[], opts: RoundRobinOpts = {}): Fixture[] {
  const { legs = 1, startRound = 1, kind = "ROUND_ROBIN" } = opts;
  const groupId = participants[0]?.groupId;
  const rounds = roundRobinPairs(participants.map((p) => p.id));
  const fixtures: Fixture[] = [];
  for (let leg = 0; leg < legs; leg++) {
    rounds.forEach((pairs, ri) => {
      const round = startRound + leg * rounds.length + ri;
      for (const [a, b] of pairs) {
        const [homeId, awayId] = leg % 2 === 0 ? [a, b] : [b, a];
        fixtures.push({ round, homeId, awayId, groupId, kind });
      }
    });
  }
  return fixtures;
}

// Round-robin WITHIN each group, aligned in lockstep (every group's round i maps
// to the same round number). Groups of different sizes simply run out of rounds
// earlier (byes). This is both the League's divisions and the Tour's conferences.
export function groupStage(participants: readonly Participant[], opts: RoundRobinOpts = {}): Fixture[] {
  const groups = new Map<string, Participant[]>();
  for (const p of participants) {
    const g = p.groupId ?? "";
    let arr = groups.get(g);
    if (!arr) {
      arr = [];
      groups.set(g, arr);
    }
    arr.push(p);
  }
  const fixtures: Fixture[] = [];
  for (const members of groups.values()) fixtures.push(...roundRobin(members, opts));
  return fixtures;
}

// Standard bracket seed order for a power-of-2 field: seeds arranged so #1 and #2
// can only meet in the final (opposite halves), #1 vs #last, etc.
//   n=8 → [1,8,4,5,2,7,3,6]
export function bracketSeedOrder(n: number): number[] {
  let order = [1, 2];
  while (order.length < n) {
    const m = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(m + 1 - s);
    }
    order = next;
  }
  return order;
}

// First-round pairings of a single-elim bracket from a seeded field (best first,
// length a power of 2). Returns [higherSeedId, lowerSeedId] pairs in bracket order.
export function standardBracketPairings(seededIds: readonly string[]): [string, string][] {
  const order = bracketSeedOrder(seededIds.length);
  const pairs: [string, string][] = [];
  for (let i = 0; i < order.length; i += 2) {
    pairs.push([seededIds[order[i]! - 1]!, seededIds[order[i + 1]! - 1]!]);
  }
  return pairs;
}

// Advance a completed round: pair consecutive winners into the next round's
// matchups (bracket order preserved).
export function advanceWinners(winnerIds: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0; i + 1 < winnerIds.length; i += 2) {
    pairs.push([winnerIds[i]!, winnerIds[i + 1]!]);
  }
  return pairs;
}
