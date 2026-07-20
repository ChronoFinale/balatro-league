import { describe, it, expect } from "vitest";
import {
  resolveBalatroSeason,
  enhancementThresholds,
  enhancementTier,
  editionTier,
  OLD_ENHANCEMENT,
  NEW_ENHANCEMENT,
} from "./balatro-ranks.js";

describe("resolveBalatroSeason", () => {
  it("parses season strings, bare numbers, and unknowns", () => {
    expect(resolveBalatroSeason("season6")).toBe(6);
    expect(resolveBalatroSeason("Season 7")).toBe(7);
    expect(resolveBalatroSeason(3)).toBe(3);
    expect(resolveBalatroSeason(undefined)).toBeUndefined();
    expect(resolveBalatroSeason(null)).toBeUndefined();
    expect(resolveBalatroSeason("preseason")).toBeUndefined();
  });
});

describe("enhancementThresholds", () => {
  it("uses OLD cutoffs for seasons 1-6, NEW for 7+ and unknown", () => {
    expect(enhancementThresholds(1)).toBe(OLD_ENHANCEMENT);
    expect(enhancementThresholds(6)).toBe(OLD_ENHANCEMENT);
    expect(enhancementThresholds("season6")).toBe(OLD_ENHANCEMENT);
    expect(enhancementThresholds(7)).toBe(NEW_ENHANCEMENT);
    expect(enhancementThresholds("season7")).toBe(NEW_ENHANCEMENT);
    expect(enhancementThresholds(99)).toBe(NEW_ENHANCEMENT);
    expect(enhancementThresholds(undefined)).toBe(NEW_ENHANCEMENT);
  });
});

describe("enhancementTier - old seasons (1-6)", () => {
  it("bands on the 230/320/460/620 cutoffs", () => {
    expect(enhancementTier(229, 3)).toBe("Stone");
    expect(enhancementTier(230, 3)).toBe("Steel");
    expect(enhancementTier(319, 3)).toBe("Steel");
    expect(enhancementTier(320, 3)).toBe("Gold");
    expect(enhancementTier(459, 3)).toBe("Gold");
    expect(enhancementTier(460, 3)).toBe("Lucky");
    expect(enhancementTier(619, 3)).toBe("Lucky");
    expect(enhancementTier(620, 3)).toBe("Glass");
  });
});

describe("enhancementTier - season 7+", () => {
  it("bands on the 530/620/760/920 cutoffs", () => {
    expect(enhancementTier(529, 7)).toBe("Stone");
    expect(enhancementTier(530, 7)).toBe("Steel");
    expect(enhancementTier(619, 7)).toBe("Steel");
    expect(enhancementTier(620, 7)).toBe("Gold");
    expect(enhancementTier(759, 7)).toBe("Gold");
    expect(enhancementTier(760, 7)).toBe("Lucky");
    expect(enhancementTier(919, 7)).toBe("Lucky");
    expect(enhancementTier(920, 7)).toBe("Glass");
  });

  it("defaults an unknown/current season to the NEW ladder", () => {
    expect(enhancementTier(620, null)).toBe("Gold");
    expect(enhancementTier(620, undefined)).toBe("Gold");
  });
});

describe("season-relative tiers", () => {
  it("the SAME mmr is a different tier across the season-7 bump", () => {
    // 620 MMR: top-tier Glass in season 3, only Gold once the ladder shifted +300.
    expect(enhancementTier(620, 3)).toBe("Glass");
    expect(enhancementTier(620, 7)).toBe("Gold");
  });

  it("regression: the pre-fix league table mislabelled season 7", () => {
    // The old flat table said 250/320/460/620 with no season, so a 700-MMR
    // season-7 player read "Glass" when they are actually only "Gold".
    expect(enhancementTier(700, "season7")).toBe("Gold");
    expect(enhancementTier(240, "season7")).toBe("Stone"); // old table said "Steel"
  });
});

describe("editionTier", () => {
  it("maps leaderboard rank to the edition overlay", () => {
    expect(editionTier(1)).toBe("Negative");
    expect(editionTier(3)).toBe("Polychrome");
    expect(editionTier(10)).toBe("Holographic");
    expect(editionTier(50)).toBe("Foil");
    expect(editionTier(51)).toBeNull();
    expect(editionTier(null)).toBeNull();
    expect(editionTier(0)).toBeNull();
  });
});
