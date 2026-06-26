// Tiebreaker builders — the library a host composes its standings chain from.
// Each returns a `Tiebreaker` whose `compare` is >0 when `a` outranks `b`.
//
//   Tour §5:  [ metricPct("matchups"), metricPct("sets"), metricPct("games"),
//              inGroupMetricPct("matchups"), headToHead() ]
//   League:   [ points(), headToHead(), metricDiff("games") ]

import type { StandingRow, StandingsContext, Tiebreaker } from "./types";

// Sign of (a% − b%) via integer cross-multiply (exact). No-games counts as 0%.
function pctSign(aF: number, aA: number, bF: number, bA: number): number {
  const at = aF + aA;
  const bt = bF + bA;
  if (at === 0 && bt === 0) return 0;
  if (at === 0) return -1;
  if (bt === 0) return 1;
  return Math.sign(aF * bt - bF * at);
}

function rowMetric(row: StandingRow, metric: string): { for: number; against: number } {
  return row.metrics[metric] ?? { for: 0, against: 0 };
}

// Tally a participant's metric for/against over the raw results, optionally
// restricted to same-group opponents or a single opponent.
function tally(
  pid: string,
  ctx: StandingsContext,
  metric: string,
  opts: { sameGroupOnly?: boolean; vsId?: string } = {},
): { for: number; against: number } {
  let f = 0;
  let a = 0;
  const myGroup = ctx.rowById.get(pid)?.groupId;
  for (const r of ctx.results) {
    const isHome = r.homeId === pid;
    const isAway = r.awayId === pid;
    if (!isHome && !isAway) continue;
    const oppId = isHome ? r.awayId : r.homeId;
    if (opts.vsId && oppId !== opts.vsId) continue;
    if (opts.sameGroupOnly && ctx.rowById.get(oppId)?.groupId !== myGroup) continue;
    const m = r.metrics[metric];
    if (!m) continue;
    f += isHome ? m[0] : m[1];
    a += isHome ? m[1] : m[0];
  }
  return { for: f, against: a };
}

/** Higher win-% of a metric (e.g. "matchups", "sets", "games"). */
export function metricPct(metric: string): Tiebreaker {
  return {
    name: `pct:${metric}`,
    compare: (a, b) => {
      const am = rowMetric(a, metric);
      const bm = rowMetric(b, metric);
      return pctSign(am.for, am.against, bm.for, bm.against);
    },
  };
}

/** Higher (for − against) differential of a metric. */
export function metricDiff(metric: string): Tiebreaker {
  return {
    name: `diff:${metric}`,
    compare: (a, b) => {
      const am = rowMetric(a, metric);
      const bm = rowMetric(b, metric);
      return Math.sign(am.for - am.against - (bm.for - bm.against));
    },
  };
}

/** Higher points (from the scoring rule). */
export function points(): Tiebreaker {
  return { name: "points", compare: (a, b) => Math.sign(a.points - b.points) };
}

/** Higher win-% of a metric counting only same-group opponents (e.g. in-conference). */
export function inGroupMetricPct(metric: string): Tiebreaker {
  return {
    name: `ingroup:${metric}`,
    compare: (a, b, ctx) => {
      const am = tally(a.participantId, ctx, metric, { sameGroupOnly: true });
      const bm = tally(b.participantId, ctx, metric, { sameGroupOnly: true });
      return pctSign(am.for, am.against, bm.for, bm.against);
    },
  };
}

/**
 * Head-to-head between the two participants. With a metric, compares their
 * summed metric against each other; without, compares wins from outcomes. Only
 * well-defined for a 2-way tie.
 */
export function headToHead(metric?: string): Tiebreaker {
  return {
    name: metric ? `h2h:${metric}` : "h2h",
    compare: (a, b, ctx) => {
      if (metric) {
        const am = tally(a.participantId, ctx, metric, { vsId: b.participantId });
        return Math.sign(am.for - am.against);
      }
      let aw = 0;
      let bw = 0;
      for (const r of ctx.results) {
        const ab = r.homeId === a.participantId && r.awayId === b.participantId;
        const ba = r.homeId === b.participantId && r.awayId === a.participantId;
        if ((!ab && !ba) || r.outcome === "DRAW") continue;
        const winnerId = r.outcome === "HOME" ? r.homeId : r.awayId;
        if (winnerId === a.participantId) aw++;
        else bw++;
      }
      return Math.sign(aw - bw);
    },
  };
}
