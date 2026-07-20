import { describe, it, expect } from "vitest";
import { describeMovement } from "./status.js";

describe("describeMovement -- promotion/relegation/safe line", () => {
  it("flags a promotion spot when rank is within the promote count", () => {
    expect(describeMovement(1, 8, 2, 2)).toContain("Promotion spot");
    expect(describeMovement(2, 8, 2, 2)).toContain("Promotion spot");
  });

  it("flags a relegation spot when rank is within the bottom relegate count", () => {
    expect(describeMovement(8, 8, 2, 2)).toContain("Relegation spot");
    expect(describeMovement(7, 8, 2, 2)).toContain("Relegation spot");
  });

  it("is safe in the middle of the table", () => {
    const line = describeMovement(4, 8, 2, 2);
    expect(line).toContain("Safe");
    expect(line).toContain("top 2 promote");
    expect(line).toContain("bottom 2 relegate");
  });

  it("is safe with no promote/relegate parens when both counts are 0", () => {
    const line = describeMovement(1, 8, 0, 0);
    expect(line).toContain("Safe");
    expect(line).not.toContain("(");
  });

  it("never flags promotion when promoteCount is 0, even at rank 1", () => {
    expect(describeMovement(1, 8, 0, 2)).toContain("Safe");
  });

  it("never flags relegation when relegateCount is 0, even at the bottom rank", () => {
    expect(describeMovement(8, 8, 2, 0)).toContain("Safe");
  });
});
