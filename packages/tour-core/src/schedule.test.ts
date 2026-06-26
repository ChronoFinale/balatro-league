import { describe, expect, it } from "vitest";
import { seededPairings, rivalPairings, generateSchedule } from "./schedule";

describe("seededPairings", () => {
  it("#1 vs #last, mirrored", () => {
    expect(seededPairings(["s1", "s2", "s3", "s4"])).toEqual([
      ["s1", "s4"],
      ["s2", "s3"],
    ]);
  });
  it("leaves the odd middle team unpaired", () => {
    expect(seededPairings(["s1", "s2", "s3"])).toEqual([["s1", "s3"]]);
  });
});

describe("rivalPairings", () => {
  it("emits each reciprocal rival pair once", () => {
    expect(rivalPairings({ a: "b", b: "a", c: "d", d: "c" })).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("generateSchedule", () => {
  it("lays round-robin into non-special weeks and inserts special weeks", () => {
    const fixtures = generateSchedule({
      conferences: [{ id: "X", teamSeasonIds: ["A", "B", "C", "D"] }],
      totalWeeks: 4,
      specialWeeks: [{ week: 3, kind: "SEEDED", pairings: [["A", "D"], ["B", "C"]] }],
    });

    // Round-robin (3 rounds) fills weeks 1, 2, 4 (week 3 is special).
    const rrWeeks = [
      ...new Set(fixtures.filter((f) => f.kind === "ROUND_ROBIN").map((f) => f.round)),
    ].sort();
    expect(rrWeeks).toEqual([1, 2, 4]);

    // Week 3 is the seeded special week.
    const w3 = fixtures.filter((f) => f.round === 3);
    expect(w3).toHaveLength(2);
    expect(w3.every((f) => f.kind === "SEEDED")).toBe(true);

    // Round-robin fixtures carry their conference as groupId.
    fixtures
      .filter((f) => f.kind === "ROUND_ROBIN")
      .forEach((f) => expect(f.groupId).toBe("X"));

    // Output is week-sorted.
    const weeks = fixtures.map((f) => f.round);
    expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
  });

  it("runs each conference's round-robin independently (no cross-conf)", () => {
    const fixtures = generateSchedule({
      conferences: [
        { id: "X", teamSeasonIds: ["A", "B", "C", "D"] },
        { id: "Y", teamSeasonIds: ["E", "F", "G", "H"] },
      ],
      totalWeeks: 3,
    });
    const confOf = (t: string) => (["A", "B", "C", "D"].includes(t) ? "X" : "Y");
    fixtures.forEach((f) => expect(confOf(f.homeId)).toBe(confOf(f.awayId)));
  });
});
