// Opponent-set helpers shared by the report / me / profile loaders. They all
// take a player's own LEAGUE_BO2 matches, partition the OTHER player ids into
// "already confirmed", "pending report", and "assigned" (on-schedule) sets, then
// filter a division's members down to the ones the player still owes a result.
//
// The schedule-locked flag is kept caller-supplied (not derived here) on purpose:
// the player-facing loaders judge "locked" from the player's own matches, while
// the admin record view judges it from the whole division's matches. See
// isScheduleLocked in ./schedule-locked.

// The fields opponentSetsFor reads off each match row.
export type OpponentMatchRow = {
  playerAId: string;
  playerBId: string;
  status: string;
};

export interface OpponentSets {
  confirmed: Set<string>; // opponents you've already CONFIRMED a result against
  pending: Set<string>; // opponents with an in-flight PENDING report
  assigned: Set<string>; // opponents on your schedule (a match of any status exists)
}

// Partition a player's own matches into opponent-id sets. `myPlayerId` is the
// viewer; each match's other id is the opponent.
export function opponentSetsFor(
  myPlayerId: string,
  myMatches: readonly OpponentMatchRow[],
): OpponentSets {
  const confirmed = new Set<string>();
  const pending = new Set<string>();
  const assigned = new Set<string>();
  for (const m of myMatches) {
    const opp = m.playerAId === myPlayerId ? m.playerBId : m.playerAId;
    assigned.add(opp);
    if (m.status === "CONFIRMED") confirmed.add(opp);
    else if (m.status === "PENDING") pending.add(opp);
  }
  return { confirmed, pending, assigned };
}

// Still owe a result against this opponent? Not already confirmed, and — when the
// schedule is locked — actually on your assigned slate (otherwise any same-
// division opponent, the legacy on-demand round-robin).
export function owesResultAgainst(
  sets: OpponentSets,
  opponentId: string,
  scheduleLocked: boolean,
): boolean {
  if (sets.confirmed.has(opponentId)) return false;
  return !scheduleLocked || sets.assigned.has(opponentId);
}
