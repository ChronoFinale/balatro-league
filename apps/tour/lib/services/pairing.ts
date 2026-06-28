// Pairing service — the TO-driven ±2 negotiation console for one matchup. The pure
// engine (tour-core `pairing.ts`) does propose→respond, ±2 validation, and dead-end
// detection; this layer reconstructs the engine state from the matchup's persisted
// TourSets each request (no in-progress state model needed), runs one transition,
// and writes the resulting pair as a PROPOSED TourSet.
//
// One TO drives both sides, so a propose+respond is collapsed into a single
// transaction — but it still respects whoseProposeTurn + the ±2 window, so the live
// two-captain tool (auth + SSE, later) layers straight on top.
import { prisma } from "../db";
import {
  initPairing,
  propose,
  respond,
  whoseProposeTurn,
  isComplete,
  isDeadlocked,
  SEED_WINDOW,
  type RosterPlayer,
  type PairingState,
} from "@balatro/tour-core";
import { rosterForWeek, ensureMembership } from "./roster-ops";

interface LoadedMatchup {
  matchup: {
    id: string;
    teamSeasonAId: string;
    teamSeasonBId: string;
    sendFirstTeamSeasonId: string | null;
    sets: { id: string; playerAId: string; playerBId: string; seedA: number; seedB: number; bestOf: number; status: string }[];
  };
  weekNumber: number;
  seasonId: string;
  seasonName: string;
  defaultBestOf: number;
  teamA: { id: string; name: string; roster: RosterPlayer[] };
  teamB: { id: string; name: string; roster: RosterPlayer[] };
  nameOf: Map<string, string>;
}

async function load(matchupId: string): Promise<LoadedMatchup | null> {
  const matchup = await prisma.matchup.findUnique({
    where: { id: matchupId },
    include: { week: { include: { season: true } }, sets: true },
  });
  if (!matchup) return null;

  const season = matchup.week.season;

  const teamSeasons = await prisma.teamSeason.findMany({
    where: { id: { in: [matchup.teamSeasonAId, matchup.teamSeasonBId] } },
    include: { team: true },
  });
  const tsById = new Map(teamSeasons.map((t) => [t.id, t]));

  // The lineup is DERIVED for this matchup's week from the roster-move log, so subs
  // / departures that apply to this week are reflected in who can be paired.
  const [lineA, lineB] = await Promise.all([
    rosterForWeek(matchup.teamSeasonAId, matchup.week.number),
    rosterForWeek(matchup.teamSeasonBId, matchup.week.number),
  ]);
  const toRoster = (line: { playerId: string; seed: number }[]): RosterPlayer[] => line.map((p) => ({ playerId: p.playerId, seed: p.seed }));

  const teamA = { id: matchup.teamSeasonAId, name: tsById.get(matchup.teamSeasonAId)?.team.name ?? "?", roster: toRoster(lineA) };
  const teamB = { id: matchup.teamSeasonBId, name: tsById.get(matchup.teamSeasonBId)?.team.name ?? "?", roster: toRoster(lineB) };

  const ids = [...new Set([...teamA.roster, ...teamB.roster].map((p) => p.playerId))];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));

  return {
    matchup,
    weekNumber: matchup.week.number,
    seasonId: season.id,
    seasonName: season.name,
    defaultBestOf: season.defaultBestOf,
    teamA,
    teamB,
    nameOf,
  };
}

// Reconstruct the engine state from the matchup's persisted pairs (TourSets).
function stateFrom(m: LoadedMatchup): PairingState {
  const sendFirst: "A" | "B" = m.matchup.sendFirstTeamSeasonId === m.matchup.teamSeasonBId ? "B" : "A";
  const base = initPairing(m.teamA.roster, m.teamB.roster, sendFirst);
  return { ...base, pairs: m.matchup.sets.map((s) => ({ aPlayerId: s.playerAId, bPlayerId: s.playerBId })) };
}

export async function getPairingConsole(matchupId: string) {
  const m = await load(matchupId);
  if (!m) return null;
  const state = stateFrom(m);
  const paired = new Set(state.pairs.flatMap((p) => [p.aPlayerId, p.bPlayerId]));
  const complete = isComplete(state);
  const deadlocked = isDeadlocked(state);

  const decorate = (team: { id: string; name: string; roster: RosterPlayer[] }) => ({
    id: team.id,
    name: team.name,
    players: team.roster.map((p) => ({ playerId: p.playerId, name: m.nameOf.get(p.playerId) ?? p.playerId, seed: p.seed, paired: paired.has(p.playerId) })),
  });

  return {
    matchupId: m.matchup.id,
    seasonName: m.seasonName,
    weekNumber: m.weekNumber,
    teamA: decorate(m.teamA),
    teamB: decorate(m.teamB),
    sendFirst: state.sendFirst,
    proposerTeam: complete ? null : whoseProposeTurn(state),
    windowSize: SEED_WINDOW,
    complete,
    deadlocked,
    pairs: m.matchup.sets.map((s) => ({
      setId: s.id,
      aName: m.nameOf.get(s.playerAId) ?? s.playerAId,
      aSeed: s.seedA,
      bName: m.nameOf.get(s.playerBId) ?? s.playerBId,
      bSeed: s.seedB,
      bestOf: s.bestOf,
      status: s.status,
    })),
  };
}

// Persist a completed pair (proposing team's player + the responder), validated
// through the engine's propose→respond + ±2 window. Writes a PROPOSED TourSet.
export async function makePair(matchupId: string, proposerPlayerId: string, responderPlayerId: string) {
  const m = await load(matchupId);
  if (!m) throw new Error("No such matchup.");
  const state = stateFrom(m);
  if (isComplete(state)) throw new Error("All players are already paired.");

  const by = whoseProposeTurn(state);
  const proposed = propose(state, by, proposerPlayerId);
  if (!proposed.ok) throw new Error(proposed.reason);
  const answered = respond(proposed.state, responderPlayerId);
  if (!answered.ok) throw new Error(answered.reason);

  await persistPair(m, answered.pair.aPlayerId, answered.pair.bPlayerId);
  return { pairs: state.pairs.length + 1 };
}

// TO override (§6.2): when the remaining players can't complete under ±2, the TO
// pairs them manually — bypasses the window but still enforces availability.
export async function overridePair(matchupId: string, aPlayerId: string, bPlayerId: string) {
  const m = await load(matchupId);
  if (!m) throw new Error("No such matchup.");
  const paired = new Set(m.matchup.sets.flatMap((s) => [s.playerAId, s.playerBId]));
  if (paired.has(aPlayerId) || paired.has(bPlayerId)) throw new Error("One of those players is already paired.");
  if (!m.teamA.roster.some((p) => p.playerId === aPlayerId)) throw new Error("Player A is not on team A's roster.");
  if (!m.teamB.roster.some((p) => p.playerId === bPlayerId)) throw new Error("Player B is not on team B's roster.");
  await persistPair(m, aPlayerId, bPlayerId);
  return { ok: true };
}

async function persistPair(m: LoadedMatchup, aPlayerId: string, bPlayerId: string) {
  const seedA = m.teamA.roster.find((p) => p.playerId === aPlayerId)?.seed ?? 0;
  const seedB = m.teamB.roster.find((p) => p.playerId === bPlayerId)?.seed ?? 0;
  await prisma.tourSet.create({
    data: {
      matchupId: m.matchup.id,
      seasonId: m.seasonId,
      playerAId: aPlayerId,
      playerBId: bPlayerId,
      seedA,
      seedB,
      bestOf: m.defaultBestOf,
      status: "PROPOSED",
    },
  });
}

// Set the coinflip winner (who proposes first). Stored on the matchup.
export async function setSendFirst(matchupId: string, team: "A" | "B") {
  const m = await prisma.matchup.findUnique({ where: { id: matchupId }, select: { teamSeasonAId: true, teamSeasonBId: true } });
  if (!m) throw new Error("No such matchup.");
  await prisma.matchup.update({
    where: { id: matchupId },
    data: { sendFirstTeamSeasonId: team === "B" ? m.teamSeasonBId : m.teamSeasonAId },
  });
}

// Deleting a TourSet doesn't cascade its core Match (Match is referenced by plain
// id, no relation — the decoupling rule), so drop any linked Match too.
export async function removePair(setId: string) {
  const s = await prisma.tourSet.findUnique({ where: { id: setId }, select: { matchId: true } });
  await prisma.tourSet.delete({ where: { id: setId } });
  if (s?.matchId) await prisma.match.delete({ where: { id: s.matchId } });
}

export async function resetPairing(matchupId: string) {
  const sets = await prisma.tourSet.findMany({ where: { matchupId }, select: { matchId: true } });
  await prisma.tourSet.deleteMany({ where: { matchupId } });
  const matchIds = sets.map((s) => s.matchId).filter((x): x is string => !!x);
  if (matchIds.length) await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
}

// Reassign the player on ONE side of an UNPLAYED set to a substitute — for a late
// "makeup" set the originally-paired player can no longer play (e.g. they dropped
// out). The set keeps its identity (matchup, week, opponent); only who plays it
// changes. TO authority: bypasses the ±2 / week-lineup checks (the sub may have
// joined after the set's week). playerAId/B = who actually plays (so stats credit
// the sub); the original is remembered in reassignedFromId for the audit.
export async function reassignSetPlayer(setId: string, side: "A" | "B", inPlayerId: string, _reason?: string) {
  if (!inPlayerId) throw new Error("Pick the substitute.");
  const set = await prisma.tourSet.findUnique({
    where: { id: setId },
    include: { matchup: { include: { week: { include: { season: { select: { id: true } } } } } } },
  });
  if (!set || !set.matchup) throw new Error("No such set.");
  if (set.status === "CONFIRMED" || set.status === "REPORTED" || set.status === "FORFEIT") {
    throw new Error("This set is already played — clear its result first, then reassign.");
  }
  const teamSeasonId = side === "A" ? set.matchup.teamSeasonAId : set.matchup.teamSeasonBId;
  const currentId = side === "A" ? set.playerAId : set.playerBId;
  const otherId = side === "A" ? set.playerBId : set.playerAId;
  if (inPlayerId === currentId) throw new Error("That player already has this set.");
  if (inPlayerId === otherId) throw new Error("Can't pair a player against themselves.");

  // The sub must attribute to this team — make sure they're a season member.
  const seed = side === "A" ? set.seedA : set.seedB;
  await ensureMembership(teamSeasonId, inPlayerId, seed);

  await prisma.tourSet.update({
    where: { id: setId },
    data: {
      ...(side === "A" ? { playerAId: inPlayerId } : { playerBId: inPlayerId }),
      reassignedFromId: set.reassignedFromId ?? currentId, // keep the FIRST original
    },
  });
  return { ok: true };
}

// Substitute options for a matchup's two teams — each team's full season membership
// plus the free-agent pool — for the reassign control (broader than the week lineup,
// since a sub may have joined later).
export async function getMatchupSubOptions(matchupId: string) {
  const matchup = await prisma.matchup.findUnique({
    where: { id: matchupId },
    include: { week: { select: { seasonId: true } } },
  });
  if (!matchup) return null;
  const seasonId = matchup.week.seasonId;

  const [teamSeasons, approved] = await Promise.all([
    prisma.teamSeason.findMany({ where: { seasonId }, include: { rosters: { include: { entries: true } } } }),
    prisma.signup.findMany({ where: { seasonId, status: "APPROVED" }, select: { discordId: true } }),
  ]);
  const memberOf = (tsId: string) => {
    const ts = teamSeasons.find((t) => t.id === tsId);
    return ts ? [...new Set(ts.rosters.flatMap((r) => r.entries.map((e) => e.playerId)))] : [];
  };
  const rosteredAll = new Set(teamSeasons.flatMap((t) => t.rosters.flatMap((r) => r.entries.map((e) => e.playerId))));
  const fa = await prisma.player.findMany({ where: { discordId: { in: approved.map((a) => a.discordId) } }, select: { id: true, displayName: true } });
  const freeAgentIds = fa.filter((p) => !rosteredAll.has(p.id)).map((p) => p.id);

  const ids = [...new Set([...memberOf(matchup.teamSeasonAId), ...memberOf(matchup.teamSeasonBId), ...freeAgentIds])];
  const players = await prisma.player.findMany({ where: { id: { in: ids } }, select: { id: true, displayName: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));
  const opt = (pid: string) => ({ id: pid, name: nameOf.get(pid) ?? pid });

  return {
    subsA: [...memberOf(matchup.teamSeasonAId), ...freeAgentIds].map(opt),
    subsB: [...memberOf(matchup.teamSeasonBId), ...freeAgentIds].map(opt),
  };
}
