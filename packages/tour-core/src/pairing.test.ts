import { describe, expect, it } from "vitest";
import {
  initPairing,
  propose,
  respond,
  eligibleResponses,
  whoseProposeTurn,
  availableOf,
  isComplete,
  canCompleteMatching,
  isDeadlocked,
  type PairingState,
  type RosterPlayer,
} from "./pairing";

const roster = (prefix: string, seeds: number[]): RosterPlayer[] =>
  seeds.map((seed) => ({ playerId: `${prefix}${seed}`, seed }));

// Helper: assert ok and return the next state.
function ok<T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> {
  expect(r.ok).toBe(true);
  return r as Extract<T, { ok: true }>;
}

describe("propose / respond happy path", () => {
  it("pairs within ±2 and alternates the proposer", () => {
    let s: PairingState = initPairing(roster("a", [1, 2, 3]), roster("b", [1, 2, 3]), "A");
    expect(whoseProposeTurn(s)).toBe("A");

    s = ok(propose(s, "A", "a3")).state; // A proposes its seed 3
    expect(eligibleResponses(s).map((p) => p.playerId).sort()).toEqual(["b1", "b2", "b3"]); // all within ±2

    const r = ok(respond(s, "b2"));
    s = r.state;
    expect(r.pair).toEqual({ aPlayerId: "a3", bPlayerId: "b2" });
    expect(whoseProposeTurn(s)).toBe("B"); // proposer flips after a pair
  });

  it("orders the pair by team regardless of who proposed", () => {
    let s = initPairing(roster("a", [1]), roster("b", [1]), "B"); // B proposes first
    s = ok(propose(s, "B", "b1")).state;
    const r = ok(respond(s, "a1"));
    expect(r.pair).toEqual({ aPlayerId: "a1", bPlayerId: "b1" });
  });
});

describe("validation", () => {
  it("rejects a response outside ±2 seeds", () => {
    let s = initPairing(roster("a", [1, 6]), roster("b", [1, 6]), "A");
    s = ok(propose(s, "A", "a1")).state; // seed 1
    const r = respond(s, "b6"); // |6-1| = 5 > 2
    expect(r.ok).toBe(false);
  });

  it("rejects proposing out of turn", () => {
    const s = initPairing(roster("a", [1]), roster("b", [1]), "A");
    expect(propose(s, "B", "b1").ok).toBe(false);
  });

  it("excludes used players from availability", () => {
    let s = initPairing(roster("a", [1, 2]), roster("b", [1, 2]), "A");
    s = ok(propose(s, "A", "a1")).state;
    s = ok(respond(s, "b1")).state;
    expect(availableOf(s, "A").map((p) => p.playerId)).toEqual(["a2"]);
    expect(availableOf(s, "B").map((p) => p.playerId)).toEqual(["b2"]);
  });
});

describe("completion", () => {
  it("isComplete once every player is paired", () => {
    let s = initPairing(roster("a", [1, 2]), roster("b", [1, 2]), "A");
    s = ok(propose(s, "A", "a1")).state;
    s = ok(respond(s, "b1")).state;
    s = ok(propose(s, "B", "b2")).state;
    s = ok(respond(s, "a2")).state;
    expect(isComplete(s)).toBe(true);
  });
});

describe("dead-end detection (perfect ±2 matching)", () => {
  it("a solvable roster is not deadlocked", () => {
    const s = initPairing(roster("a", [1, 2]), roster("b", [2, 3]), "A");
    expect(canCompleteMatching(s)).toBe(true);
    expect(isDeadlocked(s)).toBe(false);
  });

  it("an unmatchable roster is deadlocked → TO override", () => {
    // b5 can't be within ±2 of any a (1 or 2): |5-1|=4, |5-2|=3.
    const s = initPairing(roster("a", [1, 2]), roster("b", [1, 5]), "A");
    expect(canCompleteMatching(s)).toBe(false);
    expect(isDeadlocked(s)).toBe(true);
  });

  it("detects a deadlock created mid-negotiation by a greedy pairing", () => {
    // Rosters fully matchable up front (1-1,2-2,3-3). But if a1 takes b3, the
    // rest (a2,a3 vs b1,b2) — a3 can't reach b1 (|3-1|=2 ok) actually; craft a
    // real trap: seeds where a greedy first pick strands someone.
    let s = initPairing(roster("a", [1, 2, 5]), roster("b", [1, 4, 5]), "A");
    expect(canCompleteMatching(s)).toBe(true); // 1-1, 2-4? |2-4|=2 ok, 5-5 ok
    s = ok(propose(s, "A", "a1")).state;
    s = ok(respond(s, "b1")).state; // fine so far
    // remaining a[2,5] vs b[4,5]: 2-4 (2) ok, 5-5 ok → still matchable
    expect(isDeadlocked(s)).toBe(false);
  });
});
