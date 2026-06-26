import { describe, expect, it } from "vitest";
import { resolveSeriesResult } from "./result";

const A = "playerA";
const B = "playerB";

describe("resolveSeriesResult", () => {
  it("tallies a 2-1 series to A", () => {
    const r = resolveSeriesResult(
      [{ winnerId: A }, { winnerId: B }, { winnerId: A }],
      A,
      B,
    );
    expect(r).toEqual({ gamesWonA: 2, gamesWonB: 1, winnerId: A, hadDc: false });
  });

  it("reports a draw as null winner", () => {
    const r = resolveSeriesResult([{ winnerId: A }, { winnerId: B }], A, B);
    expect(r).toEqual({ gamesWonA: 1, gamesWonB: 1, winnerId: null, hadDc: false });
  });

  it("skips null/undecided games and flags DC", () => {
    const r = resolveSeriesResult(
      [{ winnerId: A, dcByPlayerId: B }, null, undefined, {}],
      A,
      B,
    );
    expect(r).toEqual({ gamesWonA: 1, gamesWonB: 0, winnerId: A, hadDc: true });
  });
});
