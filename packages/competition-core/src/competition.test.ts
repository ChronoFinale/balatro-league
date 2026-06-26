import { describe, expect, it } from "vitest";
import {
  accumulateStandings,
  computeStandings,
  rankBy,
} from "./standings";
import { metricPct, metricDiff, points, headToHead, inGroupMetricPct } from "./tiebreak";
import type {
  ContestResult,
  Participant,
  ScoringRule,
  StandingRow,
  StandingsContext,
  Tiebreaker,
} from "./types";

const EMPTY_CTX: StandingsContext = { results: [], rowById: new Map() };
const ids = (rows: StandingRow[]) => rows.map((r) => r.participantId);

// Build a row directly to isolate the tiebreaker chain (no accumulation).
function row(
  id: string,
  m: Partial<Record<string, [number, number]>>,
  extra: Partial<StandingRow> = {},
): StandingRow {
  const metrics: StandingRow["metrics"] = {};
  for (const [k, v] of Object.entries(m)) if (v) metrics[k] = { for: v[0], against: v[1] };
  return { participantId: id, groupId: "C", wins: 0, losses: 0, draws: 0, points: 0, metrics, ...extra };
}

// ── The Team Tour §5 chain, expressed purely as config ──────────────────────
const TOUR_CHAIN: Tiebreaker[] = [
  metricPct("matchups"),
  metricPct("sets"),
  metricPct("games"),
  inGroupMetricPct("matchups"),
  headToHead(),
];

describe("Tour §5 chain as config reproduces the hardcoded ordering", () => {
  it("level 1: matchup record decides first", () => {
    const a = row("a", { matchups: [5, 2], sets: [0, 40] });
    const b = row("b", { matchups: [6, 1], sets: [99, 0] });
    expect(ids(rankBy([a, b], TOUR_CHAIN, EMPTY_CTX))).toEqual(["b", "a"]);
  });

  it("level 2: equal matchups → set record", () => {
    const a = row("a", { matchups: [4, 1], sets: [30, 25] });
    const b = row("b", { matchups: [4, 1], sets: [35, 20] });
    expect(ids(rankBy([a, b], TOUR_CHAIN, EMPTY_CTX))).toEqual(["b", "a"]);
  });

  it("level 3: equal matchups+sets → game record", () => {
    const a = row("a", { matchups: [4, 1], sets: [30, 25], games: [50, 50] });
    const b = row("b", { matchups: [4, 1], sets: [30, 25], games: [60, 40] });
    expect(ids(rankBy([a, b], TOUR_CHAIN, EMPTY_CTX))).toEqual(["b", "a"]);
  });

  it("level 5: all metrics tied → head-to-head from the raw results", () => {
    const a = row("a", { matchups: [4, 1], sets: [30, 25], games: [55, 45] });
    const b = row("b", { matchups: [4, 1], sets: [30, 25], games: [55, 45] });
    const ctx: StandingsContext = {
      results: [{ homeId: "b", awayId: "a", outcome: "HOME", metrics: { matchups: [1, 0] } }],
      rowById: new Map([
        ["a", a],
        ["b", b],
      ]),
    };
    expect(ids(rankBy([a, b], TOUR_CHAIN, ctx))).toEqual(["b", "a"]); // b beat a H2H
  });

  it("level 4: in-conference record (group-filtered) breaks an otherwise tie", () => {
    // a and b tie on overall matchups/sets/games; b has the better record vs
    // same-group opponents.
    const a: StandingRow = row("a", { matchups: [2, 2] }, { groupId: "X" });
    const b: StandingRow = row("b", { matchups: [2, 2] }, { groupId: "X" });
    const inGroup = "X";
    const out = "Y";
    const results: ContestResult[] = [
      // a: 1-1 in-group, 1-1 out
      { homeId: "a", awayId: "g1", outcome: "HOME", metrics: { matchups: [1, 0] } },
      { homeId: "a", awayId: "g2", outcome: "AWAY", metrics: { matchups: [0, 1] } },
      // b: 2-0 in-group
      { homeId: "b", awayId: "g1", outcome: "HOME", metrics: { matchups: [1, 0] } },
      { homeId: "b", awayId: "g2", outcome: "HOME", metrics: { matchups: [1, 0] } },
    ];
    const rowById = new Map<string, StandingRow>([
      ["a", a],
      ["b", b],
      ["g1", row("g1", {}, { groupId: inGroup })],
      ["g2", row("g2", {}, { groupId: inGroup })],
      ["oz", row("oz", {}, { groupId: out })],
    ]);
    expect(ids(rankBy([a, b], TOUR_CHAIN, { results, rowById }))).toEqual(["b", "a"]);
  });
});

// ── The League points model, also just config ───────────────────────────────
describe("League points model as config", () => {
  const scoring: ScoringRule = (r, side) => {
    if (r.outcome === "DRAW") return 1;
    return (side === "HOME") === (r.outcome === "HOME") ? 3 : 0;
  };
  const LEAGUE_CHAIN: Tiebreaker[] = [points(), headToHead(), metricDiff("games")];

  it("accumulates points (3/1/0) and ranks by them", () => {
    const participants: Participant[] = [{ id: "a" }, { id: "b" }, { id: "c" }];
    const results: ContestResult[] = [
      { homeId: "a", awayId: "b", outcome: "HOME", metrics: { games: [2, 0] } },
      { homeId: "a", awayId: "c", outcome: "DRAW", metrics: { games: [1, 1] } },
      { homeId: "b", awayId: "c", outcome: "AWAY", metrics: { games: [0, 2] } },
    ];
    const standings = computeStandings(participants, results, { scoring, tiebreakers: LEAGUE_CHAIN });
    const table = standings.get("")!;
    // a: W + D = 4 pts; c: W + D = 4 pts; b: 2 losses = 0 pts.
    const byId = new Map(table.map((r) => [r.participantId, r]));
    expect(byId.get("a")!.points).toBe(4);
    expect(byId.get("c")!.points).toBe(4);
    expect(byId.get("b")!.points).toBe(0);
    expect(table[table.length - 1]!.participantId).toBe("b"); // b last
  });
});

describe("accumulateStandings", () => {
  it("tallies wins/losses/draws and metric for/against from both sides", () => {
    const participants: Participant[] = [{ id: "a", groupId: "X" }, { id: "b", groupId: "X" }];
    const results: ContestResult[] = [
      { homeId: "a", awayId: "b", outcome: "HOME", metrics: { sets: [6, 4] } },
    ];
    const rows = accumulateStandings(participants, results);
    const a = rows.find((r) => r.participantId === "a")!;
    const b = rows.find((r) => r.participantId === "b")!;
    expect(a.wins).toBe(1);
    expect(b.losses).toBe(1);
    expect(a.metrics.sets).toEqual({ for: 6, against: 4 });
    expect(b.metrics.sets).toEqual({ for: 4, against: 6 });
  });

  it("groups standings by groupId", () => {
    const participants: Participant[] = [
      { id: "a", groupId: "X" },
      { id: "b", groupId: "X" },
      { id: "c", groupId: "Y" },
    ];
    const standings = computeStandings(participants, [], { tiebreakers: [] });
    expect([...standings.keys()].sort()).toEqual(["X", "Y"]);
    expect(ids(standings.get("X")!).sort()).toEqual(["a", "b"]);
  });
});
