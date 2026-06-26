// Pure ban/pick state machine for a single game in a match — framework- and
// Prisma-agnostic (operates on plain `GameState` JSON). Shared by both apps so
// the league and Team Tour resolve the same ban/pick flow from one source.
//
// A ban/pick POLICY is a data-driven, ordered list of STEPS — each step is one
// player ("FIRST" = whoever bans first this game, "SECOND" = the other) taking
// one kind of action a fixed number of times:
//   - BAN    remove `count` combos from the pool
//   - PICK   nominate `count` candidate combos (the "pick 3")
//   - CHOOSE lock the single deck that gets played (the "choose 1 of 3")
// This expresses the league flow (3 ban steps → a final choose from the
// survivors), the Team Tour flow (ban 5 → pick 3 → choose 1 of 3), and
// free-deck (no steps) without hardcoding any one shape.

export interface DeckEntry {
  deck: string;
  stake: string;
}

export interface GameState {
  firstId: string; // who bans first this game
  bans: number[]; // indices into THIS game's pool that have been banned (ordered)
  // Pool indices nominated as candidates by a PICK step (the "pick 3"); a later
  // CHOOSE step locks the final deck from among these. Empty/undefined for the
  // league flow, which chooses straight from the survivors.
  candidates?: number[];
  pickedDeckIdx?: number; // which combo was locked to play
  winnerId?: string; // confirmed winner (both players' votes agreed)
  // Lives the winner had remaining (attrition, 1..MAX_GAME_LIVES). Required
  // (non-DC) before the game is DONE.
  winnerLives?: number;
  pool: DeckEntry[];
  voteByA?: string;
  voteByB?: string;
  disputed?: boolean;
  rerollVoteByA?: boolean;
  rerollVoteByB?: boolean;
  dcByPlayerId?: string;
  pickedRandomly?: boolean;
  firstBannedRandomly?: boolean;
  otherBannedRandomly?: boolean;
}

export function emptyGameState(firstId: string, pool: DeckEntry[]): GameState {
  return { firstId, bans: [], pool };
}

// Lives a game starts with (attrition). The winner's REMAINING lives are
// captured per game; loser is 0 by definition.
export const MAX_GAME_LIVES = 4;

// "FIRST" = whoever bans first in this game (game.firstId); "SECOND" = the other.
export type StepPlayer = "FIRST" | "SECOND";
export type StepKind = "BAN" | "PICK" | "CHOOSE";

export interface BanPickStep {
  kind: StepKind;
  by: StepPlayer;
  // BAN: combos to ban; PICK: candidates to nominate; CHOOSE: locks the final
  // deck (treated as 1 regardless of count).
  count: number;
}

export interface BanPickPolicy {
  poolSize: number;
  steps: BanPickStep[];
}

// League: first bans 1, second bans 3, first bans 3, then the second player
// chooses the final deck from the 2 survivors. (First shaped the pool with 4
// bans, so the second gets the final say.)
export const LEAGUE_POLICY: BanPickPolicy = {
  poolSize: 9,
  steps: [
    { kind: "BAN", by: "FIRST", count: 1 },
    { kind: "BAN", by: "SECOND", count: 3 },
    { kind: "BAN", by: "FIRST", count: 3 },
    { kind: "CHOOSE", by: "SECOND", count: 1 },
  ],
};

// Team Tour: first bans 5 (9 → 4 left), second nominates 3 of the 4 as
// candidates, first chooses 1 of those 3 to play.
export const TOUR_POLICY: BanPickPolicy = {
  poolSize: 9,
  steps: [
    { kind: "BAN", by: "FIRST", count: 5 },
    { kind: "PICK", by: "SECOND", count: 3 },
    { kind: "CHOOSE", by: "FIRST", count: 1 },
  ],
};

// Free deck: no guided ban/pick — players agree on / report any combo. The
// state machine has nothing to drive, so phaseFor jumps straight to PLAYING.
export const FREE_DECK_POLICY: BanPickPolicy = { poolSize: 0, steps: [] };

// Historical default = the league flow. Used when no policy is stamped.
export const DEFAULT_POLICY: BanPickPolicy = LEAGUE_POLICY;

function isStep(x: unknown): x is BanPickStep {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    (s.kind === "BAN" || s.kind === "PICK" || s.kind === "CHOOSE") &&
    (s.by === "FIRST" || s.by === "SECOND") &&
    typeof s.count === "number"
  );
}

export function parsePolicy(json: string | null): BanPickPolicy {
  if (!json) return DEFAULT_POLICY;
  try {
    const p = JSON.parse(json) as Partial<BanPickPolicy>;
    if (typeof p.poolSize === "number" && Array.isArray(p.steps) && p.steps.every(isStep)) {
      return { poolSize: p.poolSize, steps: p.steps };
    }
  } catch {
    // fall through
  }
  return DEFAULT_POLICY;
}

export type Phase =
  | { kind: "BAN"; whoseBanId: string; remainingForThem: number; totalDone: number }
  // Nominate candidate combos (the "pick 3"). `remaining` left to nominate.
  | { kind: "PICK"; pickerId: string; remaining: number }
  // Lock the single deck to play (from candidates if any were nominated,
  // otherwise from the survivors).
  | { kind: "CHOOSE"; chooserId: string }
  | { kind: "PLAYING" }
  | { kind: "AWAIT_LIVES"; winnerId: string }
  | { kind: "DONE" };

// Given current game state, player IDs, and the ban policy, return what phase
// the game is in and who's acting. Walks the policy's steps in order and returns
// the first incomplete one. Used to render the embed + decide which buttons are
// clickable.
export function phaseFor(
  game: GameState,
  playerAId: string,
  playerBId: string,
  policy: BanPickPolicy,
): Phase {
  const otherId = game.firstId === playerAId ? playerBId : playerAId;
  const idOf = (by: StepPlayer): string => (by === "FIRST" ? game.firstId : otherId);

  if (game.winnerId) {
    // DC forfeits skip lives capture (no real attrition result). Otherwise the
    // winner must record their remaining lives before the game is done.
    if (!game.dcByPlayerId && game.winnerLives == null) {
      return { kind: "AWAIT_LIVES", winnerId: game.winnerId };
    }
    return { kind: "DONE" };
  }
  if (game.pickedDeckIdx !== undefined) return { kind: "PLAYING" };

  let bansSeen = 0;
  let picksSeen = 0;
  const candCount = game.candidates?.length ?? 0;
  for (const step of policy.steps) {
    if (step.kind === "BAN") {
      const done = game.bans.length - bansSeen;
      if (done < step.count) {
        return {
          kind: "BAN",
          whoseBanId: idOf(step.by),
          remainingForThem: step.count - done,
          totalDone: game.bans.length,
        };
      }
      bansSeen += step.count;
    } else if (step.kind === "PICK") {
      const done = candCount - picksSeen;
      if (done < step.count) {
        return { kind: "PICK", pickerId: idOf(step.by), remaining: step.count - done };
      }
      picksSeen += step.count;
    } else {
      // CHOOSE — pickedDeckIdx is still undefined (checked above), so this is
      // the pending final choice.
      return { kind: "CHOOSE", chooserId: idOf(step.by) };
    }
  }
  // No steps left to act on (e.g. free-deck, or every step satisfied) → playing.
  return { kind: "PLAYING" };
}

// Survivors: pool combos that haven't been banned.
export function remainingCombos(
  pool: DeckEntry[],
  bans: number[],
): { idx: number; combo: DeckEntry }[] {
  const banned = new Set(bans);
  const out: { idx: number; combo: DeckEntry }[] = [];
  pool.forEach((combo, idx) => {
    if (!banned.has(idx)) out.push({ idx, combo });
  });
  return out;
}

// Combos a CHOOSE step locks the final deck from: the PICK-nominated candidates
// if any were nominated, otherwise the survivors (pool minus bans).
export function choosableCombos(game: GameState): { idx: number; combo: DeckEntry }[] {
  if (game.candidates && game.candidates.length > 0) {
    const out: { idx: number; combo: DeckEntry }[] = [];
    for (const idx of game.candidates) {
      const combo = game.pool[idx];
      if (combo) out.push({ idx, combo });
    }
    return out;
  }
  return remainingCombos(game.pool, game.bans);
}

// Which player owns the ban at the given 0-based ordinal, per the policy's BAN
// steps in order. Returns null for an ordinal past the defined bans.
export function banOwner(
  ordinal: number,
  firstId: string,
  otherId: string,
  policy: BanPickPolicy,
): string | null {
  let seen = 0;
  for (const step of policy.steps) {
    if (step.kind !== "BAN") continue;
    if (ordinal < seen + step.count) return step.by === "FIRST" ? firstId : otherId;
    seen += step.count;
  }
  return null;
}
