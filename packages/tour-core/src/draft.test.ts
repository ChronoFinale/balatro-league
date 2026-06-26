import { describe, expect, it } from "vitest";
import { buildDraft, snakeOrder, isSelfPickRound } from "./draft";

describe("snakeOrder", () => {
  it("reverses each round", () => {
    expect(snakeOrder(["t1", "t2", "t3"], 2)).toEqual(["t1", "t2", "t3", "t3", "t2", "t1"]);
  });
});

describe("buildDraft", () => {
  it("assigns sequential pick indices and round = intra-team seed", () => {
    const slots = buildDraft(["t1", "t2"], 3);
    expect(slots.map((s) => s.pickIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(slots.map((s) => s.round)).toEqual([1, 1, 2, 2, 3, 3]);
    expect(slots.every((s) => s.intraTeamSeed === s.round)).toBe(true);
  });

  it("captain self-picks in the committee-set round", () => {
    // t1 self-picks round 1; t2 round 3; t3 round 2 (independent of draft order).
    const slots = buildDraft(["t1", "t2", "t3"], 3, { t1: 1, t2: 3, t3: 2 });
    const selfPicks = slots.filter((s) => s.isSelfPick);
    expect(selfPicks.map((s) => `${s.teamSeasonId}@${s.round}`).sort()).toEqual([
      "t1@1",
      "t2@3",
      "t3@2",
    ]);
  });

  it("flags no self-picks when none are supplied", () => {
    expect(buildDraft(["t1", "t2"], 3).some((s) => s.isSelfPick)).toBe(false);
  });
});

describe("isSelfPickRound", () => {
  it("matches the captain's committee-set round", () => {
    expect(isSelfPickRound(5, 5)).toBe(true);
    expect(isSelfPickRound(5, 1)).toBe(false);
  });
});
