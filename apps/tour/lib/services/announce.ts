// Announcement payloads for the bot (#results embeds). The web owns all shaping — the
// bot just renders. Null when the thing isn't announceable (undecided / missing).
import { prisma } from "../db";

export interface SetAnnouncePayload {
  kind: "set";
  seasonName: string;
  week: number | null;
  bracket: string | null;
  forfeit: boolean;
  winnerName: string;
  loserName: string;
  winnerGames: number;
  loserGames: number;
  winnerTeam: string | null;
  loserTeam: string | null;
  games: { num: number; deck: string | null; stake: string | null; winnerName: string | null }[];
  urlPath: string; // relative to the site base
}

export async function setAnnouncePayload(setId: string): Promise<SetAnnouncePayload | null> {
  const set = await prisma.tourSet.findUnique({ where: { id: setId } });
  if (!set?.matchId || !set.seasonId) return null;
  const [match, season] = await Promise.all([
    prisma.match.findUnique({ where: { id: set.matchId }, include: { games: { orderBy: { num: "asc" } } } }),
    prisma.tourSeason.findUnique({ where: { id: set.seasonId }, select: { name: true } }),
  ]);
  if (!match?.winnerId || !season) return null;

  const pids = [set.playerAId, set.playerBId];
  const players = await prisma.player.findMany({ where: { id: { in: pids } }, select: { id: true, displayName: true } });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));
  const winnerId = match.winnerId;
  const loserId = winnerId === set.playerAId ? set.playerBId : set.playerAId;
  const winnerGames = match.playerAId === winnerId ? match.gamesWonA : match.gamesWonB;
  const loserGames = match.playerAId === winnerId ? match.gamesWonB : match.gamesWonA;

  // Teams via the set's played-as columns (fall back to the matchup).
  let teamA = set.teamSeasonAId;
  let teamB = set.teamSeasonBId;
  if ((!teamA || !teamB) && set.matchupId) {
    const mu = await prisma.matchup.findUnique({ where: { id: set.matchupId }, select: { teamSeasonAId: true, teamSeasonBId: true } });
    teamA = teamA ?? mu?.teamSeasonAId ?? null;
    teamB = teamB ?? mu?.teamSeasonBId ?? null;
  }
  const tsIds = [teamA, teamB].filter((x): x is string => !!x);
  const teamSeasons = tsIds.length ? await prisma.teamSeason.findMany({ where: { id: { in: tsIds } }, include: { team: true } }) : [];
  const teamNameOf = new Map(teamSeasons.map((t) => [t.id, t.team.name]));
  const winnerIsA = winnerId === set.playerAId;
  const winnerTeam = winnerIsA ? (teamA ? teamNameOf.get(teamA) ?? null : null) : teamB ? teamNameOf.get(teamB) ?? null : null;
  const loserTeam = winnerIsA ? (teamB ? teamNameOf.get(teamB) ?? null : null) : teamA ? teamNameOf.get(teamA) ?? null : null;

  return {
    kind: "set",
    seasonName: season.name,
    week: set.week,
    bracket: set.bracket,
    forfeit: set.status === "FORFEIT" || !!match.forfeit,
    winnerName: nameOf.get(winnerId) ?? "?",
    loserName: nameOf.get(loserId) ?? "?",
    winnerGames,
    loserGames,
    winnerTeam,
    loserTeam,
    games: match.games.map((g) => ({ num: g.num, deck: g.deck ?? null, stake: g.stake ?? null, winnerName: g.winnerId ? nameOf.get(g.winnerId) ?? null : null })),
    urlPath: `/seasons/${encodeURIComponent(season.name)}/weeks`,
  };
}

export interface MatchupAnnouncePayload {
  kind: "matchup";
  seasonName: string;
  week: number;
  teamA: string;
  teamB: string;
  setsA: number;
  setsB: number;
  winnerTeam: string | null;
  urlPath: string;
}

export async function matchupAnnouncePayload(matchupId: string): Promise<MatchupAnnouncePayload | null> {
  const mu = await prisma.matchup.findUnique({
    where: { id: matchupId },
    include: { week: { include: { season: { select: { name: true } } } } },
  });
  if (!mu || mu.setsWonA == null || mu.setsWonB == null) return null;
  const teamSeasons = await prisma.teamSeason.findMany({ where: { id: { in: [mu.teamSeasonAId, mu.teamSeasonBId] } }, include: { team: true } });
  const nameOf = new Map(teamSeasons.map((t) => [t.id, t.team.name]));
  return {
    kind: "matchup",
    seasonName: mu.week.season.name,
    week: mu.week.number,
    teamA: nameOf.get(mu.teamSeasonAId) ?? "?",
    teamB: nameOf.get(mu.teamSeasonBId) ?? "?",
    setsA: mu.setsWonA,
    setsB: mu.setsWonB,
    winnerTeam: mu.winnerTeamSeasonId ? nameOf.get(mu.winnerTeamSeasonId) ?? null : null,
    urlPath: `/seasons/${encodeURIComponent(mu.week.season.name)}/weeks`,
  };
}
