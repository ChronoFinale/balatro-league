import { describe, it, expect } from "vitest";
import { elowen1v1, ELOWEN_DEFAULTS, type Rating } from "./elowen.js";

const settled = (mmr: number): Rating => ({ mmr, volatility: ELOWEN_DEFAULTS.maxVolatility });
const fresh = (mmr: number): Rating => ({ mmr, volatility: 0 });

describe("elowen1v1 — core Elo behaviour (settled volatility → gMultiplier 1.0)", () => {
  it("even match swings by ~baseChange (17.5)", () => {
    const r = elowen1v1(settled(1000), settled(1000));
    expect(r.change).toBeCloseTo(17.5, 1);
  });

  it("an underdog win pays more than an even match (toward 2×base)", () => {
    const r = elowen1v1(settled(800), settled(1200)); // 800 beats 1200
    expect(r.change).toBeGreaterThan(17.5);
    expect(r.change).toBeLessThan(35); // capped by 2·baseChange
    expect(r.change).toBeCloseTo(23.9, 1);
  });

  it("a favourite win pays less than an even match (toward 0)", () => {
    const r = elowen1v1(settled(1200), settled(800)); // 1200 beats 800
    expect(r.change).toBeLessThan(17.5);
    expect(r.change).toBeCloseTo(11.1, 1);
  });

  it("is zero-sum: winner gains exactly what loser loses", () => {
    const r = elowen1v1(settled(1000), settled(1050));
    expect(r.winner.mmr - 1000).toBeCloseTo(1050 - r.loser.mmr, 1);
  });
});

describe("elowen1v1 — volatility (provisional / decaying-K)", () => {
  it("a fresh player swings 1.75× harder than a settled one on the same matchup", () => {
    const freshSwing = elowen1v1(fresh(1000), fresh(1000)).change;
    const settledSwing = elowen1v1(settled(1000), settled(1000)).change;
    expect(freshSwing).toBeCloseTo(settledSwing * 1.75, 1);
    expect(freshSwing).toBeCloseTo(30.6, 1); // 1.75 × 17.5
  });

  it("increments volatility each game and caps at maxVolatility", () => {
    const r = elowen1v1(fresh(1000), { mmr: 1000, volatility: 14 });
    expect(r.winner.volatility).toBe(1);
    expect(r.loser.volatility).toBe(15); // 14 → 15, capped
    const capped = elowen1v1(settled(1000), settled(1000));
    expect(capped.winner.volatility).toBe(15);
  });
});

describe("elowen1v1 — clamping", () => {
  it("never drops a loser below 0", () => {
    // Even matchup, fresh players → ~30.6 swing; a loser at 10 would go
    // negative, so it floors at 0.
    const r = elowen1v1(fresh(10), fresh(10));
    expect(r.loser.mmr).toBe(0);
    expect(r.winner.mmr).toBeCloseTo(40.6, 1);
  });

  it("respects a tuned variance (smaller → gaps matter more)", () => {
    const wide = elowen1v1(settled(1200), settled(800), { ...ELOWEN_DEFAULTS, variance: 1200 }).change;
    const narrow = elowen1v1(settled(1200), settled(800), { ...ELOWEN_DEFAULTS, variance: 400 }).change;
    // A narrower variance makes the favourite's win pay even less.
    expect(narrow).toBeLessThan(wide);
  });
});
