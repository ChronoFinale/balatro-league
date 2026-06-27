// Player-side set reporting with both-player confirmation (B6). A player reports
// their set from their own perspective ("my games – opponent's games"); the result
// sits as REPORTED until the OPPONENT confirms (→ CONFIRMED → matchup rollup →
// standings) or disputes (→ DISPUTED → a TO resolves via the admin report path).
//
// The actor is always the authenticated viewer's playerId (the caller passes it);
// every op verifies that player is actually in the set.
import { prisma } from "../db";
import { rollupMatchup } from "./report";

async function loadSetForPlayer(setId: string, playerId: string) {
  const set = await prisma.tourSet.findUnique({ where: { id: setId } });
  if (!set) throw new Error("No such set.");
  const isA = set.playerAId === playerId;
  const isB = set.playerBId === playerId;
  if (!isA && !isB) throw new Error("You're not a player in this set.");
  return { set, isA };
}

export async function playerReportSet(setId: string, playerId: string, myGames: number, oppGames: number) {
  const { set, isA } = await loadSetForPlayer(setId, playerId);
  if (!Number.isInteger(myGames) || !Number.isInteger(oppGames) || myGames < 0 || oppGames < 0) {
    throw new Error("Scores must be whole numbers ≥ 0.");
  }
  if (myGames === 0 && oppGames === 0) throw new Error("Enter the games each of you won.");

  // The reporter's perspective → team-A / team-B games (A = the set's playerA team).
  const gamesTeamA = isA ? myGames : oppGames;
  const gamesTeamB = isA ? oppGames : myGames;
  const a = set.playerAId;
  const b = set.playerBId;
  const swap = b < a; // core Match is canonical: playerA.id < playerB.id
  const winnerId = gamesTeamA > gamesTeamB ? a : gamesTeamB > gamesTeamA ? b : null;

  const data = {
    playerAId: swap ? b : a,
    playerBId: swap ? a : b,
    format: `BO${set.bestOf}`,
    gamesWonA: swap ? gamesTeamB : gamesTeamA,
    gamesWonB: swap ? gamesTeamA : gamesTeamB,
    winnerId,
    status: "PENDING" as const, // awaiting opponent confirm
    reporterId: playerId,
    reportedAt: new Date(),
    confirmedAt: null,
    disputedById: null,
    disputeReason: null,
  };

  let matchId = set.matchId;
  if (matchId) await prisma.match.update({ where: { id: matchId }, data });
  else matchId = (await prisma.match.create({ data })).id;
  await prisma.tourSet.update({ where: { id: setId }, data: { matchId, status: "REPORTED" } });
  // No matchup rollup yet — only a CONFIRMED set counts toward standings.
  return { ok: true };
}

export async function playerConfirmSet(setId: string, playerId: string) {
  const { set } = await loadSetForPlayer(setId, playerId);
  if (set.status !== "REPORTED" || !set.matchId) throw new Error("There's nothing to confirm.");
  const m = await prisma.match.findUnique({ where: { id: set.matchId }, select: { reporterId: true } });
  if (m?.reporterId === playerId) throw new Error("You reported this set — your opponent confirms it.");
  await prisma.match.update({ where: { id: set.matchId }, data: { status: "CONFIRMED", confirmedAt: new Date() } });
  await prisma.tourSet.update({ where: { id: setId }, data: { status: "CONFIRMED" } });
  if (set.matchupId) await rollupMatchup(set.matchupId);
  return { ok: true };
}

export async function playerDisputeSet(setId: string, playerId: string, reason: string) {
  const { set } = await loadSetForPlayer(setId, playerId);
  if (set.status !== "REPORTED" || !set.matchId) throw new Error("There's nothing to dispute.");
  const m = await prisma.match.findUnique({ where: { id: set.matchId }, select: { reporterId: true } });
  if (m?.reporterId === playerId) throw new Error("You reported this set — re-report it instead of disputing.");
  await prisma.match.update({
    where: { id: set.matchId },
    data: { status: "DISPUTED", disputedById: playerId, disputeReason: reason.trim() || null, disputedAt: new Date() },
  });
  await prisma.tourSet.update({ where: { id: setId }, data: { status: "DISPUTED" } });
  return { ok: true };
}
