// @balatro/competition-core — generic competition kernel (the STRUCTURE around
// matches). Designed against two real consumers (Balatro League + Team Tour) so
// each becomes config, not bespoke code. See types.ts for the contracts.
//
// Built so far: the abstractions (types) + the standings engine (accumulate /
// rankBy / computeStandings) + the tiebreaker builder library. Formats
// (round-robin, single-elim, …) and progression rules land next.

export * from "./types";
export * from "./standings";
export * from "./tiebreak";
export * from "./format";
export * from "./progression";
