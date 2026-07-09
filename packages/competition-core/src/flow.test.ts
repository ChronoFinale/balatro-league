// End-to-end proof that the kernel models the full Team Tour structure:
//   conferences → in-conference round-robin → results → standings →
//   playoff qualification (berths + wildcards) → overall seeding → bracket.

import { describe, expect, it } from "vitest";
import { groupStage, standardBracketPairings, advanceWinners, bracketSeedOrder } from "./format";
import { computeStandings } from "./standings";
import { metricPct, inGroupMetricPct, headToHead } from "./tiebreak";
import { qualify, seedField, assembleBracketByChoice, promoteRelegate } from "./progression";
import type { ContestResult, Participant, StandingRow, Tiebreaker } from "./types";

const TOUR_CHAIN: Tiebreaker[] = [
  metricPct("matchups"),
  metricPct("sets"),
  metricPct("games"),
  inGroupMetricPct("matchups"),
  headToHead(),
];

describe("format library", () => {
  it("groupStage runs an independent round-robin per conference, lockstep", () => {
    const teams: Participant[] = [
      ...["x1", "x2", "x3", "x4"].map((id) => ({ id, groupId: "X" })),
      ...["y1", "y2", "y3", "y4"].map((id) => ({ id, groupId: "Y" })),
    ];
    const fixtures = groupStage(teams);
    // 4 teams → 3 rounds × 2 games = 6 per conference, 12 total.
    expect(fixtures).toHaveLength(12);
    // No cross-conference fixtures.
    const confOf = (id: string) => (id.startsWith("x") ? "X" : "Y");
    fixtures.forEach((f) => expect(confOf(f.homeId)).toBe(confOf(f.awayId)));
    // Rounds align across conferences (both use weeks 1..3).
    expect([...new Set(fixtures.map((f) => f.round))].sort()).toEqual([1, 2, 3]);
  });

  it("bracketSeedOrder puts #1 and #2 in opposite halves", () => {
    expect(bracketSeedOrder(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });
});

describe("full season → playoffs flow", () => {
  it("conferences → round-robin → standings → qualify → seed → bracket", () => {
    // Two 4-team conferences. Lower-numbered teams are stronger (win their games).
    const teams: Participant[] = [
      ...["x1", "x2", "x3", "x4"].map((id, i) => ({ id, groupId: "X", seed: i + 1 })),
      ...["y1", "y2", "y3", "y4"].map((id, i) => ({ id, groupId: "Y", seed: i + 1 })),
    ];

    const fixtures = groupStage(teams);

    // Deterministic results: the lower id wins each matchup (3 sets to keep it
    // simple), so within a conference standings = seed order.
    const rank = (id: string) => Number(id.slice(1));
    const results: ContestResult[] = fixtures.map((f) => {
      const homeStronger = rank(f.homeId) < rank(f.awayId);
      return {
        homeId: f.homeId,
        awayId: f.awayId,
        groupId: f.groupId,
        outcome: homeStronger ? "HOME" : "AWAY",
        metrics: { matchups: homeStronger ? [1, 0] : [0, 1] },
      } satisfies ContestResult;
    });

    const standings = computeStandings(teams, results, { tiebreakers: TOUR_CHAIN });
    // Each conference ends in seed order.
    expect(standings.get("X")!.map((r) => r.participantId)).toEqual(["x1", "x2", "x3", "x4"]);
    expect(standings.get("Y")!.map((r) => r.participantId)).toEqual(["y1", "y2", "y3", "y4"]);

    // Overall ranking (best→worst) — for the proof, interleave by wins then seed.
    const allRows: StandingRow[] = [...standings.get("X")!, ...standings.get("Y")!];
    const overallRanked = [...allRows]
      .sort((a, b) => b.wins - a.wins || rank(a.participantId) - rank(b.participantId))
      .map((r) => r.participantId);

    // Top 1 per conference (berths) + wildcards to a 4-team field.
    const field = qualify({ byGroup: standings, overallRanked, perGroup: 1, fieldSize: 4 });
    expect(field).toHaveLength(4);
    // x1 and y1 are conference winners (berths); the next two best are wildcards.
    const berths = field.filter((q) => !q.viaWildcard).map((q) => q.participantId).sort();
    expect(berths).toEqual(["x1", "y1"]);
    expect(field.filter((q) => q.viaWildcard)).toHaveLength(2);

    // Seed and build the bracket.
    const seeded = seedField(field, overallRanked);
    expect(seeded).toHaveLength(4);
    const qf = standardBracketPairings(seeded);
    // 4-team bracket: (#1 v #4), (#2 v #3) — #1 and #2 in opposite halves.
    expect(qf).toEqual([
      [seeded[0]!, seeded[3]!],
      [seeded[1]!, seeded[2]!],
    ]);

    // Advance: top seeds win → final pairs the two half-winners.
    const sf = advanceWinners([seeded[0]!, seeded[1]!]);
    expect(sf).toEqual([[seeded[0]!, seeded[1]!]]);
  });
});

describe("re-seed by choice", () => {
  it("validates picks and places #1/#2 in opposite halves (8-team field)", () => {
    const seeded = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];
    // #1 picks s8, #2 picks s7, #3 picks s6, #4 picks s5.
    const res = assembleBracketByChoice(seeded, { s1: "s8", s2: "s7", s3: "s6", s4: "s5" });
    expect(res.ok).toBe(true);
    // #1's pair in the first half, #2's pair in the second half.
    const firstHalf = res.pairs.slice(0, res.pairs.length / 2).flat();
    const secondHalf = res.pairs.slice(res.pairs.length / 2).flat();
    expect(firstHalf).toContain("s1");
    expect(secondHalf).toContain("s2");
    // Standard seeding: #1 shares the top half with #4, #2 shares the bottom with #3.
    expect(firstHalf).toContain("s4");
    expect(secondHalf).toContain("s3");
  });

  it("rejects an ineligible or duplicate pick", () => {
    const seeded = ["s1", "s2", "s3", "s4"];
    expect(assembleBracketByChoice(seeded, { s1: "s2", s2: "s4" }).ok).toBe(false); // s2 is a chooser, not pickable
    expect(assembleBracketByChoice(seeded, { s1: "s3", s2: "s3" }).ok).toBe(false); // duplicate
  });
});

describe("promotion / relegation (League)", () => {
  it("splits a division into promoted / relegated / stayed", () => {
    const div: StandingRow[] = ["a", "b", "c", "d", "e"].map((id) => ({
      participantId: id,
      wins: 0, losses: 0, draws: 0, points: 0, metrics: {},
    }));
    const mv = promoteRelegate(div, { promote: 1, relegate: 2 });
    expect(mv.promoted).toEqual(["a"]);
    expect(mv.relegated).toEqual(["d", "e"]);
    expect(mv.stayed).toEqual(["b", "c"]);
  });
});
