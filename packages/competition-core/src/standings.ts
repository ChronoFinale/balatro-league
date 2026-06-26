// Standings engine: reduce contest results into per-participant rows, then rank
// each group by a configurable tiebreaker chain. Generic over what a participant
// is and what metrics a contest reports — the host supplies both.

import type {
  ContestResult,
  Participant,
  ScoringRule,
  StandingRow,
  StandingsConfig,
  StandingsContext,
  Tiebreaker,
} from "./types";

// Reduce results into one row per participant (unranked). Participants with no
// results still get a zeroed row so they appear in standings.
export function accumulateStandings(
  participants: readonly Participant[],
  results: readonly ContestResult[],
  scoring?: ScoringRule,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();
  const ensure = (id: string, groupId?: string): StandingRow => {
    let r = rows.get(id);
    if (!r) {
      r = { participantId: id, groupId, wins: 0, losses: 0, draws: 0, points: 0, metrics: {} };
      rows.set(id, r);
    }
    return r;
  };
  for (const p of participants) ensure(p.id, p.groupId);

  const addMetric = (row: StandingRow, name: string, f: number, a: number): void => {
    const m = row.metrics[name] ?? { for: 0, against: 0 };
    m.for += f;
    m.against += a;
    row.metrics[name] = m;
  };

  for (const res of results) {
    const home = ensure(res.homeId);
    const away = ensure(res.awayId);
    if (res.outcome === "HOME") {
      home.wins++;
      away.losses++;
    } else if (res.outcome === "AWAY") {
      away.wins++;
      home.losses++;
    } else {
      home.draws++;
      away.draws++;
    }
    if (scoring) {
      home.points += scoring(res, "HOME");
      away.points += scoring(res, "AWAY");
    }
    for (const [name, pair] of Object.entries(res.metrics)) {
      addMetric(home, name, pair[0], pair[1]);
      addMetric(away, name, pair[1], pair[0]);
    }
  }
  return [...rows.values()];
}

// Stable sort by the tiebreaker chain (first decisive link wins). A tiebreaker's
// `compare` returns >0 when `a` outranks `b`, so we negate for the sort.
export function rankBy(
  rows: readonly StandingRow[],
  tiebreakers: readonly Tiebreaker[],
  ctx: StandingsContext,
): StandingRow[] {
  return [...rows].sort((a, b) => {
    for (const tb of tiebreakers) {
      const c = tb.compare(a, b, ctx);
      if (c !== 0) return -c;
    }
    return 0;
  });
}

// Full pipeline: accumulate → group by groupId ("" if ungrouped) → rank each
// group by the config's chain.
export function computeStandings(
  participants: readonly Participant[],
  results: readonly ContestResult[],
  config: StandingsConfig,
): Map<string, StandingRow[]> {
  const rows = accumulateStandings(participants, results, config.scoring);
  const ctx: StandingsContext = {
    results,
    rowById: new Map(rows.map((r) => [r.participantId, r])),
  };
  const byGroup = new Map<string, StandingRow[]>();
  for (const r of rows) {
    const g = r.groupId ?? "";
    let arr = byGroup.get(g);
    if (!arr) {
      arr = [];
      byGroup.set(g, arr);
    }
    arr.push(r);
  }
  for (const [g, grp] of byGroup) byGroup.set(g, rankBy(grp, config.tiebreakers, ctx));
  return byGroup;
}
