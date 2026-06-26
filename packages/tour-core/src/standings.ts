// The Team Tour's standings tiebreaker chain (§5), expressed as competition-core
// config. The generic engine (computeStandings) does all the work; the Tour just
// supplies this ordered chain.
//
//   1. matchup record   2. set record   3. game record
//   4. in-conference matchup record     5. head-to-head
//
// The game-level metric fed in as `ContestResult.metrics.games` must already be
// Bo-X→Bo3 NORMALIZED (§12.4 / `normalizeSetToBo3` in bo-x.ts) so variable set
// lengths compare fairly.

import {
  metricPct,
  inGroupMetricPct,
  headToHead,
  type Tiebreaker,
} from "@balatro/competition-core";

export const TOUR_TIEBREAKERS: Tiebreaker[] = [
  metricPct("matchups"),
  metricPct("sets"),
  metricPct("games"),
  inGroupMetricPct("matchups"),
  headToHead(),
];
