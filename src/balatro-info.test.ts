import { describe, it, expect } from "vitest";
import { deckSlug, stakeSlug } from "./balatro-info.js";

describe("deck/stake slugs", () => {
  it("lowercases and replaces non-alphanumerics with underscores", () => {
    expect(deckSlug("White Stake")).toBe("white_stake");
    expect(deckSlug("Red")).toBe("red");
    expect(stakeSlug("Gold Stake")).toBe("gold_stake");
  });

  it("keeps Spectral and Spectral+ distinct (regression: + must not collapse away)", () => {
    // The bug: stripping "+" made both slug to "spectral", colliding their
    // asset/emoji keys. "+" now maps to "_plus".
    expect(stakeSlug("Spectral")).toBe("spectral");
    expect(stakeSlug("Spectral+")).toBe("spectral_plus");
    expect(stakeSlug("Spectral")).not.toBe(stakeSlug("Spectral+"));
    expect(deckSlug("Spectral+")).toBe("spectral_plus");
  });

  it("trims leading/trailing separators and collapses runs", () => {
    expect(deckSlug("  Painted Deck  ")).toBe("painted_deck");
    expect(deckSlug("A / B")).toBe("a_b");
  });
});
