// Progression — turning a finished stage's standings into the next structure:
// who qualifies, how they're seeded, the playoff bracket, and (League)
// promotion/relegation. Pure; the host persists the outcomes.

import type { StandingRow } from "./types";
import { bracketSeedOrder } from "./format";

export interface QualifiedParticipant {
  participantId: string;
  groupId?: string;
  viaWildcard: boolean;
}

export interface QualifyArgs {
  // Per-group standings, already ranked best-first (e.g. computeStandings output).
  byGroup: Map<string, StandingRow[]>;
  // All participant ids ranked best→worst OVERALL (cross-group), for wildcards +
  // seeding. The host produces this with the same tiebreaker chain over one pool.
  overallRanked: readonly string[];
  perGroup: number; // automatic berths per group (Tour: 2)
  fieldSize: number; // total playoff field (Tour: 8); remainder = wildcards
}

/**
 * Top `perGroup` from each group earn automatic berths; the field is then filled
 * to `fieldSize` with the best remaining teams by `overallRanked` (wildcards).
 * Result order follows `overallRanked` (so it's already seedable).
 */
export function qualify(args: QualifyArgs): QualifiedParticipant[] {
  const { byGroup, overallRanked, perGroup, fieldSize } = args;
  const berths = new Set<string>();
  const groupOf = new Map<string, string | undefined>();
  for (const [g, rows] of byGroup) {
    rows.slice(0, perGroup).forEach((r) => {
      berths.add(r.participantId);
      groupOf.set(r.participantId, g === "" ? undefined : g);
    });
    rows.forEach((r) => {
      if (!groupOf.has(r.participantId)) groupOf.set(r.participantId, g === "" ? undefined : g);
    });
  }

  const qualified: QualifiedParticipant[] = [];
  // Walk overall order: take berth-holders, then wildcards, until the field is full.
  for (const id of overallRanked) {
    if (qualified.length >= fieldSize) break;
    const isBerth = berths.has(id);
    if (isBerth) {
      qualified.push({ participantId: id, groupId: groupOf.get(id), viaWildcard: false });
    }
  }
  for (const id of overallRanked) {
    if (qualified.length >= fieldSize) break;
    if (!berths.has(id)) {
      qualified.push({ participantId: id, groupId: groupOf.get(id), viaWildcard: true });
    }
  }
  return qualified;
}

/**
 * Seed a qualified field best-first by overall rank → ids in seed order
 * (index 0 = #1 seed). Qualifiers not present in `overallRanked` sort last.
 */
export function seedField(
  qualified: readonly QualifiedParticipant[],
  overallRanked: readonly string[],
): string[] {
  const rank = new Map(overallRanked.map((id, i) => [id, i]));
  return [...qualified]
    .map((q) => q.participantId)
    .sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity));
}

// ── Re-seed by choice (Tour §6.5) — the ceremony's pure core ─────────────────
// #1 picks its first-round opponent from the lower seeds, then #2, … Choosers
// are the top half of the field; eligible opponents are the bottom half. The
// assembler validates the picks and places #1/#2 in opposite halves.
export interface ByChoiceResult {
  ok: boolean;
  pairs: [string, string][]; // [chooserId, opponentId] in bracket order
  reason?: string;
}

export function assembleBracketByChoice(
  seededIds: readonly string[],
  picks: Record<string, string>, // chooserId → chosen opponentId
): ByChoiceResult {
  const n = seededIds.length;
  const half = n / 2;
  const choosers = seededIds.slice(0, half); // #1..#half
  const pickable = new Set(seededIds.slice(half)); // bottom half
  const used = new Set<string>();
  const pairs: [string, string][] = [];

  for (const chooser of choosers) {
    const opp = picks[chooser];
    if (!opp) return { ok: false, pairs: [], reason: `no pick for ${chooser}` };
    if (!pickable.has(opp)) return { ok: false, pairs: [], reason: `${opp} not an eligible opponent` };
    if (used.has(opp)) return { ok: false, pairs: [], reason: `${opp} already chosen` };
    used.add(opp);
    pairs.push([chooser, opp]);
  }
  // Order the chooser pairs so #1 and #2 land in opposite halves of the bracket.
  const ordered = reorderOppositeHalves(pairs, seededIds);
  return { ok: true, pairs: ordered };
}

// Place the chooser pairs into standard bracket slots (bracketSeedOrder) so the
// result is a normal seeded single-elim: #1 and #2 can only meet in the final, and
// #1 shares its half with the lowest-ranked chooser (n=8 halves = {1,4} and {2,3}).
// The chooser pairs anchor the "higher seed" slots, which sit at bracketSeedOrder's
// even indices — exactly the top half of the field.
function reorderOppositeHalves(
  pairs: readonly [string, string][],
  seededIds: readonly string[],
): [string, string][] {
  const seedIdx = (id: string) => seededIds.indexOf(id); // 0-based seed of the chooser
  const byChooser = new Map(pairs.map((p) => [seedIdx(p[0]), p] as const));
  const order = bracketSeedOrder(seededIds.length); // 1-based standard seed order
  const out: [string, string][] = [];
  for (let k = 0; k < pairs.length; k++) {
    const pair = byChooser.get((order[2 * k] ?? 0) - 1);
    if (pair) out.push([pair[0], pair[1]]);
  }
  return out.length === pairs.length ? out : [...pairs];
}

// ── Promotion / relegation (League) ──────────────────────────────────────────
export interface PromotionMovements {
  promoted: string[]; // top `promote` of this division (move up)
  relegated: string[]; // bottom `relegate` (move down)
  stayed: string[];
}

/** Split one division's ranked standings into promoted / relegated / stayed. */
export function promoteRelegate(
  divisionRanked: readonly StandingRow[],
  opts: { promote: number; relegate: number },
): PromotionMovements {
  const ids = divisionRanked.map((r) => r.participantId);
  const promoted = ids.slice(0, opts.promote);
  const relegated = opts.relegate > 0 ? ids.slice(ids.length - opts.relegate) : [];
  const relSet = new Set(relegated);
  const promSet = new Set(promoted);
  const stayed = ids.filter((id) => !relSet.has(id) && !promSet.has(id));
  return { promoted, relegated, stayed };
}
