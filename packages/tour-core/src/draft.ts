// Snake draft order + captain self-pick (design §6.1 / §0). The committee sets the
// team draft order (seed 1 picks first); the snake reverses each round. Each pick
// assigns the picked player's intra-team seed (= the round number). Each captain
// picks THEMSELVES "in the round they are seeded to be selected" (TT10 rules) — a
// committee-set valuation per captain (1..rounds), supplied as data. It is NOT the
// team's draft position: real seasons have more teams than rounds (e.g. 18 teams,
// 7 player-rounds), so a draft-seed-based formula would strand most captains.
//
// No pick deadline / autodraft — the draft is async (user call); any clock is
// purely cosmetic (DraftPick.onClockAt/pickedAt).

export interface DraftSlot {
  pickIndex: number; // 0-based overall pick order
  round: number; // 1-based
  teamSeasonId: string;
  intraTeamSeed: number; // seed this pick assigns within the team (= round)
  isSelfPick: boolean; // the captain picks themselves this round
}

/**
 * The full draft board: every pick slot in order. `teamIdsBySeed` is the team
 * draft order (index 0 = seed 1 = picks first). Round 1 goes forward, round 2
 * reverses, etc. (snake). `captainSelfPickRound` maps a team → the round its
 * captain self-picks (committee-set); teams omitted never auto-self-pick.
 */
export function buildDraft(
  teamIdsBySeed: readonly string[],
  rounds: number,
  captainSelfPickRound: Readonly<Record<string, number>> = {},
): DraftSlot[] {
  const slots: DraftSlot[] = [];
  let pickIndex = 0;
  for (let round = 1; round <= rounds; round++) {
    const order = round % 2 === 1 ? teamIdsBySeed : [...teamIdsBySeed].reverse();
    for (const teamSeasonId of order) {
      slots.push({
        pickIndex,
        round,
        teamSeasonId,
        intraTeamSeed: round,
        isSelfPick: captainSelfPickRound[teamSeasonId] === round,
      });
      pickIndex++;
    }
  }
  return slots;
}

/** Flat pick order of team ids (snake). */
export function snakeOrder(teamIdsBySeed: readonly string[], rounds: number): string[] {
  return buildDraft(teamIdsBySeed, rounds).map((s) => s.teamSeasonId);
}

/** Whether a captain self-picks in the given round, per their committee-set round. */
export function isSelfPickRound(captainSelfPickRound: number, round: number): boolean {
  return captainSelfPickRound === round;
}
