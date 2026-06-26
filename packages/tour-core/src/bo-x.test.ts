import { describe, expect, it } from "vitest";
import { setWinThreshold, competitiveFloor, normalizeSetToBo3 } from "./bo-x";

describe("setWinThreshold", () => {
  it("matches the §12.4 table", () => {
    expect(setWinThreshold(3)).toBe(2);
    expect(setWinThreshold(5)).toBe(3);
    expect(setWinThreshold(7)).toBe(4);
    expect(setWinThreshold(9)).toBe(5);
  });
});

describe("competitiveFloor", () => {
  it("reproduces the table's 'loser wins for' column (1,1,2)", () => {
    expect(competitiveFloor(3)).toBe(1);
    expect(competitiveFloor(5)).toBe(1);
    expect(competitiveFloor(7)).toBe(2);
  });
});

describe("normalizeSetToBo3", () => {
  it("Bo3: 2-1 competitive, 2-0 sweep", () => {
    expect(normalizeSetToBo3(1, 3)).toEqual({ w: 2, l: 1 });
    expect(normalizeSetToBo3(0, 3)).toEqual({ w: 2, l: 0 });
  });

  it("Bo5: 3-1 and 3-2 competitive, 3-0 sweep", () => {
    expect(normalizeSetToBo3(2, 5)).toEqual({ w: 2, l: 1 });
    expect(normalizeSetToBo3(1, 5)).toEqual({ w: 2, l: 1 });
    expect(normalizeSetToBo3(0, 5)).toEqual({ w: 2, l: 0 });
  });

  it("Bo7: 4-2 and 4-3 competitive, 4-1 and 4-0 sweep", () => {
    expect(normalizeSetToBo3(3, 7)).toEqual({ w: 2, l: 1 });
    expect(normalizeSetToBo3(2, 7)).toEqual({ w: 2, l: 1 });
    expect(normalizeSetToBo3(1, 7)).toEqual({ w: 2, l: 0 });
    expect(normalizeSetToBo3(0, 7)).toEqual({ w: 2, l: 0 });
  });
});
