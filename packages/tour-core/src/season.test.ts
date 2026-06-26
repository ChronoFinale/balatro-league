// End-to-end proof that the whole Team Tour domain COMPOSES across both packages:
// a mini season runs draft → schedule → results → standings → playoff
// qualification → seeding → bracket, plus a ±2 pairing negotiation — all from the
// pure functions, no DB or Discord. This is the orchestration the app's service
// layer will perform; here it's exercised purely.

import { describe, expect, it } from "vitest";
import {
  computeStandings,
  qualify,
  seedField,
  standardBracketPairings,
  type ContestResult,
  type Participant,
} from "@balatro/competition-core";
import { generateSchedule, seededPairings } from "./schedule";
import { TOUR_TIEBREAKERS } from "./standings";
import { buildDraft } from "./draft";
import { initPairing, propose, respond, isComplete } from "./pairing";

// 8 teams across 2 conferences. Overall seed (lower = stronger) interleaves the
// conferences so each conference's internal order is clean.
const OVERALL_SEED: Record<string, number> = {
  x1: 1, y1: 2, x2: 3, y2: 4, x3: 5, y3: 6, x4: 7, y4: 8,
};
const CONF_X = ["x1", "x2", "x3", "x4"];
const CONF_Y = ["y1", "y2", "y3", "y4"];
const ALL = [...CONF_X, ...CONF_Y];

describe("full Tour season composes end-to-end", () => {
  it("schedule → results → standings → qualify → seed → bracket", () => {
    const participants: Participant[] = [
      ...CONF_X.map((id) => ({ id, groupId: "X", seed: OVERALL_SEED[id] })),
      ...CONF_Y.map((id) => ({ id, groupId: "Y", seed: OVERALL_SEED[id] })),
    ];

    // Schedule: in-conference round-robin (weeks 1–3) + a Seeded cross-conf week 4.
    const overallOrder = [...ALL].sort((a, b) => OVERALL_SEED[a]! - OVERALL_SEED[b]!);
    const fixtures = generateSchedule({
      conferences: [
        { id: "X", teamSeasonIds: CONF_X },
        { id: "Y", teamSeasonIds: CONF_Y },
      ],
      totalWeeks: 4,
      specialWeeks: [{ week: 4, kind: "SEEDED", pairings: seededPairings(overallOrder) }],
    });
    expect(fixtures.some((f) => f.kind === "SEEDED")).toBe(true);

    // Simulate: the stronger (lower overall seed) team always wins its matchup.
    const results: ContestResult[] = fixtures.map((f) => {
      const homeStronger = OVERALL_SEED[f.homeId]! < OVERALL_SEED[f.awayId]!;
      return {
        homeId: f.homeId,
        awayId: f.awayId,
        groupId: f.groupId,
        outcome: homeStronger ? "HOME" : "AWAY",
        metrics: {
          matchups: homeStronger ? [1, 0] : [0, 1],
          sets: homeStronger ? [6, 5] : [5, 6],
          games: homeStronger ? [2, 1] : [1, 2], // already Bo-X→Bo3 normalized
        },
      } satisfies ContestResult;
    });

    // Standings: each conference ends in internal seed order.
    const standings = computeStandings(participants, results, { tiebreakers: TOUR_TIEBREAKERS });
    expect(standings.get("X")!.map((r) => r.participantId)).toEqual(CONF_X);
    expect(standings.get("Y")!.map((r) => r.participantId)).toEqual(CONF_Y);

    // Playoffs: 1 automatic berth per conference + wildcards to a 4-team field.
    const field = qualify({
      byGroup: standings,
      overallRanked: overallOrder,
      perGroup: 1,
      fieldSize: 4,
    });
    expect(field.filter((q) => !q.viaWildcard).map((q) => q.participantId).sort()).toEqual(["x1", "y1"]);
    expect(field.filter((q) => q.viaWildcard)).toHaveLength(2);

    // Seed + bracket: #1 and #2 land in opposite halves.
    const seeded = seedField(field, overallOrder);
    expect(seeded).toEqual(["x1", "y1", "x2", "y2"]);
    const qf = standardBracketPairings(seeded);
    expect(qf).toEqual([
      ["x1", "y2"],
      ["y1", "x2"],
    ]);
  });

  it("draft: snake order with committee-set captain self-picks across 8 teams", () => {
    const draftOrder = ["x1", "y1", "x2", "y2", "x3", "y3", "x4", "y4"]; // committee draft order
    // 8 teams over 7 rounds → captain valuations all fit within the rounds
    // (more teams than rounds, like the real event).
    const selfPick: Record<string, number> = { x1: 1, y1: 1, x2: 2, y2: 3, x3: 4, y3: 5, x4: 6, y4: 7 };
    const slots = buildDraft(draftOrder, 7, selfPick);
    expect(slots).toHaveLength(8 * 7);
    for (const team of draftOrder) {
      const selfPicks = slots.filter((s) => s.teamSeasonId === team && s.isSelfPick);
      expect(selfPicks).toHaveLength(1);
      expect(selfPicks[0]!.round).toBe(selfPick[team]);
    }
  });

  it("pairing: a matchup negotiates to a complete ±2 lineup", () => {
    const a = [1, 2, 3].map((seed) => ({ playerId: `a${seed}`, seed }));
    const b = [1, 2, 3].map((seed) => ({ playerId: `b${seed}`, seed }));
    let s = initPairing(a, b, "A");

    // A proposes 2, B answers 3 (±1); B proposes 1, A answers 1; A proposes 3, B answers 2.
    s = (propose(s, "A", "a2") as { ok: true; state: typeof s }).state;
    s = (respond(s, "b3") as { ok: true; state: typeof s }).state;
    s = (propose(s, "B", "b1") as { ok: true; state: typeof s }).state;
    s = (respond(s, "a1") as { ok: true; state: typeof s }).state;
    s = (propose(s, "A", "a3") as { ok: true; state: typeof s }).state;
    s = (respond(s, "b2") as { ok: true; state: typeof s }).state;

    expect(isComplete(s)).toBe(true);
    expect(s.pairs).toEqual([
      { aPlayerId: "a2", bPlayerId: "b3" },
      { aPlayerId: "a1", bPlayerId: "b1" },
      { aPlayerId: "a3", bPlayerId: "b2" },
    ]);
  });
});
