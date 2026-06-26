import { describe, expect, it } from "vitest";
import { computeStandings, type ContestResult, type Participant } from "@balatro/competition-core";
import { TOUR_TIEBREAKERS } from "./standings";

// The §5 chain itself is exhaustively tested in competition-core. Here we just
// confirm the Tour's config is wired correctly to the generic engine.
describe("TOUR_TIEBREAKERS over computeStandings", () => {
  it("ranks a conference by the matchup → set → game chain", () => {
    const teams: Participant[] = [
      { id: "a", groupId: "X" },
      { id: "b", groupId: "X" },
      { id: "c", groupId: "X" },
    ];
    const results: ContestResult[] = [
      // a beats b and c; b beats c → standings a, b, c.
      { homeId: "a", awayId: "b", groupId: "X", outcome: "HOME", metrics: { matchups: [1, 0], sets: [6, 5], games: [2, 1] } },
      { homeId: "a", awayId: "c", groupId: "X", outcome: "HOME", metrics: { matchups: [1, 0], sets: [6, 4], games: [2, 1] } },
      { homeId: "b", awayId: "c", groupId: "X", outcome: "HOME", metrics: { matchups: [1, 0], sets: [6, 5], games: [2, 1] } },
    ];
    const table = computeStandings(teams, results, { tiebreakers: TOUR_TIEBREAKERS }).get("X")!;
    expect(table.map((r) => r.participantId)).toEqual(["a", "b", "c"]);
  });

  it("is the five-link chain in §5 order", () => {
    expect(TOUR_TIEBREAKERS.map((t) => t.name)).toEqual([
      "pct:matchups",
      "pct:sets",
      "pct:games",
      "ingroup:matchups",
      "h2h",
    ]);
  });
});
