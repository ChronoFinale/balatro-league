// Per-season import config — lets you import any past season as SWISS or
// CONFERENCES. Seasons not listed default to SWISS (one combined pool).
//
//   format: "SWISS"        → one pool, ranked by the chain (one standings table).
//   format: "CONFERENCES"  → split into groups; provide the split via either:
//       conferenceStandingsSheet: "Standings.html"   (parsed by parse-conferences), OR
//       conferences: { Pluto: ["Team A", ...], Eris: [...] }   (explicit)
//     Teams not matched to a conference land in "Unassigned".
//
// Edit this, then `npm run import`. (The season key is the integer in the
// alltime sheets; e.g. 1/2/3.)

export const SEASON_CONFIG = {
  1: { format: "SWISS" },
  2: { format: "SWISS" },
  3: { format: "SWISS" },

  // Example — a conference season whose split lives in a Standings sheet:
  // 10: { format: "CONFERENCES", conferenceStandingsSheet: "Standings.html" },
};

export const DEFAULT_SEASON = { format: "SWISS" };
