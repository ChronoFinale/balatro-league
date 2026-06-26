// @balatro/competition-core — the generic competition kernel.
//
// match-core is the 1v1 MATCH engine. This layer is the STRUCTURE around matches:
// formats produce fixtures from participants; results reduce into standings ranked
// by a configurable tiebreaker chain; progression rules turn standings into the
// next structure (promotion/relegation, playoff seeding).
//
// Every abstraction here is validated against TWO real consumers so it isn't
// speculative:
//   • Balatro League — individuals, round-robin divisions w/ promotion-relegation,
//     points-based standings (win/tie/loss).
//   • Team Tour      — teams, round-robin conferences + special weeks + playoffs,
//     a 3-level (matchup/set/game) W-L tiebreaker chain.
// The host app maps its own entities onto these; the kernel stays ignorant of
// Discord, Prisma, decks, players-vs-teams, etc.

// A competitor in a competition — a person (League: a Player) or a team (Tour: a
// TeamSeason). Opaque to the kernel: just an id, optional seed, optional group.
export interface Participant {
  id: string; // host id — League playerId / Tour teamSeasonId
  seed?: number; // seeding within its group (draft seed, ladder rank, …)
  groupId?: string; // division / conference; undefined = a single pool
}

// One scheduled contest between two participants in a round/week.
export interface Fixture {
  round: number; // 1-based round (League week / Tour week)
  homeId: string; // participant id
  awayId: string; // participant id
  groupId?: string; // same-group fixture; undefined = cross-group / global
  kind?: string; // host tag: "ROUND_ROBIN" | "RIVAL" | "SEEDED" | "PLAYOFF" | …
}

// A format turns participants into fixtures — a pluggable strategy.
//   League:  divisions  = round-robin per group, 2 legs (home/away).
//   Tour:    groupStage = round-robin per conference + injected special weeks.
//   future:  singleElim, swiss, …
export type Format<O = unknown> = (participants: readonly Participant[], opts?: O) => Fixture[];

// The outcome of ONE contest, expressed in standings terms. The host maps its
// match data into named metric tallies `[homeFor, awayFor]`:
//   League: { games: [2, 1] }                       (one level)
//   Tour:   { matchups: [1,0], sets: [6,5], games: [7,5] }  (three levels;
//            `games` pre-normalized Bo-X→Bo3 by the host, §12.4)
// `outcome` is the headline win/loss/draw used by win counts + scoring.
export interface ContestResult {
  homeId: string;
  awayId: string;
  groupId?: string;
  outcome: "HOME" | "AWAY" | "DRAW";
  metrics: Record<string, readonly [number, number]>;
}

// Accumulated standing for one participant (the reduction of all its results).
export interface StandingRow {
  participantId: string;
  groupId?: string;
  wins: number;
  losses: number;
  draws: number;
  points: number; // from the scoring rule (0 if none configured)
  // Per-metric running totals, summed across the participant's contests.
  metrics: Record<string, { for: number; against: number }>;
}

// Points awarded to one side of a contest (League: 3 win / 1 draw / 0 loss).
// Tour can omit scoring and rank purely on metric tiebreakers.
export type ScoringRule = (result: ContestResult, side: "HOME" | "AWAY") => number;

// What a tiebreaker may consult beyond the two rows — needed for head-to-head
// and group-filtered metrics (e.g. "in-conference record").
export interface StandingsContext {
  results: readonly ContestResult[];
  rowById: ReadonlyMap<string, StandingRow>;
}

// One link in the tiebreaker chain. Returns >0 if `a` should rank ABOVE `b` on
// this criterion, <0 if below, 0 if tied / not-applicable (→ fall through to the
// next link). Build these with the helpers in `tiebreak.ts`.
export interface Tiebreaker {
  name: string;
  compare: (a: StandingRow, b: StandingRow, ctx: StandingsContext) => number;
}

// How to compute a group's standings: optional scoring + the ordered tiebreaker
// chain (first decisive link wins).
//   Tour §5:   [ metricPct("matchups"), metricPct("sets"), metricPct("games"),
//               inGroupMetricPct("matchups"), headToHead() ]
//   League:    [ points(), headToHead(), metricDiff("games") ]
export interface StandingsConfig {
  scoring?: ScoringRule;
  tiebreakers: Tiebreaker[];
}
