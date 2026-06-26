// Team Tour schedule orchestration (§6.4/§12.6). The generic round-robin lives in
// competition-core; this is the Tour-specific glue: lay each conference's
// round-robin into the non-special week slots, then drop in the special weeks
// (Rival / Cross-Conf / Seeded). Output is competition-core `Fixture`s (round =
// week number, kind = the Tour week kind).

import { roundRobinPairs, type Fixture } from "@balatro/competition-core";

export type TourWeekKind = "ROUND_ROBIN" | "RIVAL" | "CROSS_CONF" | "SEEDED" | "PLAYOFF";

// Seeded-week pairings (§6.4): #1 vs #last, mirrored, by overall seed order.
export function seededPairings(seedOrder: readonly string[]): [string, string][] {
  const pairs: [string, string][] = [];
  for (let i = 0, j = seedOrder.length - 1; i < j; i++, j--) {
    pairs.push([seedOrder[i]!, seedOrder[j]!]);
  }
  return pairs;
}

// Rival-week pairings from a (reciprocal) rival map — each pair emitted once.
export function rivalPairings(rivals: Record<string, string>): [string, string][] {
  const seen = new Set<string>();
  const pairs: [string, string][] = [];
  for (const [a, b] of Object.entries(rivals)) {
    if (seen.has(a) || seen.has(b)) continue;
    seen.add(a);
    seen.add(b);
    pairs.push([a, b]);
  }
  return pairs;
}

// A non-round-robin week with explicit pairings (built via the helpers above or
// set by the TO).
export interface SpecialWeek {
  week: number; // 1-based
  kind: "RIVAL" | "CROSS_CONF" | "SEEDED";
  pairings: [string, string][];
}

export interface ScheduleInput {
  // Teams per conference, in seed order. Each conference plays its own round-robin.
  conferences: { id: string; teamSeasonIds: string[] }[];
  totalWeeks: number; // regular-season week count (e.g. 7)
  specialWeeks?: SpecialWeek[]; // weeks that are NOT in-conference round-robin
}

/**
 * Assemble the regular season as `Fixture`s. Each conference's round-robin (from
 * competition-core) fills the non-special week slots in lockstep — conferences of
 * different sizes run out of rounds earlier, leaving byes — and the special weeks
 * drop in at their week numbers. A *draft* the TO reviews and tweaks (§6.4).
 */
export function generateSchedule(input: ScheduleInput): Fixture[] {
  const special = input.specialWeeks ?? [];
  const specialByWeek = new Map(special.map((s) => [s.week, s]));
  const out: Fixture[] = [];

  const rrWeeks: number[] = [];
  for (let w = 1; w <= input.totalWeeks; w++) {
    if (!specialByWeek.has(w)) rrWeeks.push(w);
  }

  for (const conf of input.conferences) {
    const rounds = roundRobinPairs(conf.teamSeasonIds);
    for (let i = 0; i < rounds.length && i < rrWeeks.length; i++) {
      const week = rrWeeks[i]!;
      for (const [homeId, awayId] of rounds[i]!) {
        out.push({ round: week, kind: "ROUND_ROBIN", homeId, awayId, groupId: conf.id });
      }
    }
  }

  for (const s of special) {
    for (const [homeId, awayId] of s.pairings) {
      out.push({ round: s.week, kind: s.kind, homeId, awayId });
    }
  }

  return out.sort((a, b) => a.round - b.round);
}
