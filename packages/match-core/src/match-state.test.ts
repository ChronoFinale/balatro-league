import { describe, expect, it } from "vitest";
import {
  LEAGUE_POLICY,
  FREE_DECK_POLICY,
  DEFAULT_POLICY,
  emptyGameState,
  phaseFor,
  banOwner,
  choosableCombos,
  parsePolicy,
  type DeckEntry,
  type GameState,
} from "./match-state";

const A = "playerA";
const B = "playerB";

// 9-combo pool with room for the league flow (7 bans → 2 survivors → choose).
const POOL: DeckEntry[] = Array.from({ length: 9 }, (_, i) => ({
  deck: `deck${i}`,
  stake: "white",
}));

// Drive bans by appending the next unbanned pool index.
function ban(game: GameState, n: number): void {
  for (let i = 0; i < n; i++) {
    const banned = new Set(game.bans);
    const next = game.pool.findIndex((_, idx) => !banned.has(idx) && !game.bans.includes(idx));
    game.bans.push(next);
  }
}

describe("league policy phase sequence", () => {
  it("walks first→second→first bans then a second-player choose", () => {
    const g = emptyGameState(A, POOL); // A bans first

    let p = phaseFor(g, A, B, LEAGUE_POLICY);
    expect(p).toMatchObject({ kind: "BAN", whoseBanId: A, remainingForThem: 1 });

    ban(g, 1); // A's single ban
    p = phaseFor(g, A, B, LEAGUE_POLICY);
    expect(p).toMatchObject({ kind: "BAN", whoseBanId: B, remainingForThem: 3 });

    ban(g, 3); // B bans 3
    p = phaseFor(g, A, B, LEAGUE_POLICY);
    expect(p).toMatchObject({ kind: "BAN", whoseBanId: A, remainingForThem: 3 });

    ban(g, 3); // A bans 3 more (7 total banned)
    p = phaseFor(g, A, B, LEAGUE_POLICY);
    // 2 survivors; the second player (B) chooses the final.
    expect(p).toEqual({ kind: "CHOOSE", chooserId: B });
    expect(choosableCombos(g)).toHaveLength(2);

    g.pickedDeckIdx = choosableCombos(g)[0]!.idx;
    expect(phaseFor(g, A, B, LEAGUE_POLICY)).toEqual({ kind: "PLAYING" });
  });
});

describe("free-deck policy", () => {
  it("goes straight to PLAYING with no steps", () => {
    const g = emptyGameState(A, POOL);
    expect(phaseFor(g, A, B, FREE_DECK_POLICY)).toEqual({ kind: "PLAYING" });
  });
});

describe("terminal phases", () => {
  it("requires winner lives before DONE (non-DC)", () => {
    const g = emptyGameState(A, POOL);
    g.pickedDeckIdx = 0;
    g.winnerId = A;
    expect(phaseFor(g, A, B, LEAGUE_POLICY)).toEqual({ kind: "AWAIT_LIVES", winnerId: A });
    g.winnerLives = 3;
    expect(phaseFor(g, A, B, LEAGUE_POLICY)).toEqual({ kind: "DONE" });
  });

  it("DC forfeit skips lives capture", () => {
    const g = emptyGameState(A, POOL);
    g.pickedDeckIdx = 0;
    g.winnerId = A;
    g.dcByPlayerId = B;
    expect(phaseFor(g, A, B, LEAGUE_POLICY)).toEqual({ kind: "DONE" });
  });
});

describe("banOwner attribution", () => {
  it("league: ordinal 0 + 4..6 → first, 1..3 → second", () => {
    const owners = [0, 1, 2, 3, 4, 5, 6].map((o) => banOwner(o, A, B, LEAGUE_POLICY));
    expect(owners).toEqual([A, B, B, B, A, A, A]);
    expect(banOwner(7, A, B, LEAGUE_POLICY)).toBeNull(); // past the bans
  });
});

describe("parsePolicy", () => {
  it("round-trips a valid policy", () => {
    expect(parsePolicy(JSON.stringify(LEAGUE_POLICY))).toEqual(LEAGUE_POLICY);
  });
  it("falls back to default on null / garbage / wrong shape", () => {
    expect(parsePolicy(null)).toEqual(DEFAULT_POLICY);
    expect(parsePolicy("not json")).toEqual(DEFAULT_POLICY);
    expect(parsePolicy(JSON.stringify({ firstPlayerBans: 4 }))).toEqual(DEFAULT_POLICY);
  });
});
