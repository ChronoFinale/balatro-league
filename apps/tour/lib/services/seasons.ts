// Season service — the centralized logic for season read/write. Pure: validates
// + touches the DB, no auth (the caller gates). Called from API routes, server
// actions, and (later) the bot — one implementation, many entry points.
import { prisma } from "../db";

export type SeasonFormat = "SWISS" | "CONFERENCES";

export interface CreateSeasonInput {
  name: string;
  format: SeasonFormat;
  teamSize: number;
  setsToWin?: number;
  conferenceCount?: number;
  playoffTeams?: number;
  defaultBestOf?: number;
}

const majority = (n: number) => Math.floor(n / 2) + 1;

export function listSeasons() {
  return prisma.tourSeason.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { teamSeasons: true } } },
  });
}

// One season + the lifecycle counts the admin hub needs. null if not found.
export async function getSeasonAdmin(name: string) {
  const season = await prisma.tourSeason.findUnique({
    where: { name },
    include: {
      _count: { select: { teamSeasons: true, conferences: true, weeks: true, signups: true } },
      draft: { select: { state: true } },
    },
  });
  if (!season) return null;

  const grouped = await prisma.signup.groupBy({
    by: ["status"],
    where: { seasonId: season.id },
    _count: { _all: true },
  });
  const signups = { PENDING: 0, APPROVED: 0, REJECTED: 0, WITHDRAWN: 0 } as Record<string, number>;
  for (const g of grouped) signups[g.status] = g._count._all;

  return { season, signups };
}

export async function createSeason(input: CreateSeasonInput) {
  const name = (input.name ?? "").trim();
  if (!name) throw new Error("Season name is required");
  if (input.format !== "SWISS" && input.format !== "CONFERENCES") throw new Error("format must be SWISS or CONFERENCES");
  const teamSize = Number(input.teamSize) || 11;
  if (teamSize < 1) throw new Error("teamSize must be ≥ 1");

  const existing = await prisma.tourSeason.findUnique({ where: { name }, select: { id: true } });
  if (existing) throw new Error(`A season named "${name}" already exists`);

  return prisma.tourSeason.create({
    data: {
      name,
      format: input.format,
      teamSize,
      setsToWin: Number(input.setsToWin) || majority(teamSize),
      conferenceCount: Number(input.conferenceCount) || 2,
      playoffTeams: Number(input.playoffTeams) || 8,
      defaultBestOf: Number(input.defaultBestOf) || 5,
      state: "SIGNUPS",
    },
  });
}

// Delete a season + all its season-scoped data. Conferences / teamSeasons /
// rosters / weeks / matchups cascade via FK; TourSets, their Matches, and
// PlayoffSeries are season-linked by plain id, so they're cleared explicitly.
export async function deleteSeason(name: string) {
  const season = await prisma.tourSeason.findUnique({ where: { name }, select: { id: true } });
  if (!season) throw new Error(`No season "${name}"`);
  const sets = await prisma.tourSet.findMany({ where: { seasonId: season.id }, select: { matchId: true } });
  const matchIds = sets.map((s) => s.matchId).filter((x): x is string => !!x);
  await prisma.tourSet.deleteMany({ where: { seasonId: season.id } });
  if (matchIds.length) await prisma.match.deleteMany({ where: { id: { in: matchIds } } });
  await prisma.playoffSeries.deleteMany({ where: { seasonId: season.id } });
  return prisma.tourSeason.delete({ where: { id: season.id } });
}

export interface UpdateSeasonInput {
  format?: SeasonFormat;
  teamSize?: number;
  setsToWin?: number;
  conferenceCount?: number;
  playoffTeams?: number;
  state?: "SIGNUPS" | "DRAFTING" | "REGULAR" | "PLAYOFFS" | "DONE";
}

export async function updateSeason(name: string, patch: UpdateSeasonInput) {
  const season = await prisma.tourSeason.findUnique({ where: { name }, select: { id: true } });
  if (!season) throw new Error(`No season "${name}"`);
  return prisma.tourSeason.update({
    where: { id: season.id },
    data: {
      ...(patch.format ? { format: patch.format } : {}),
      ...(patch.teamSize != null ? { teamSize: Number(patch.teamSize) } : {}),
      ...(patch.setsToWin != null ? { setsToWin: Number(patch.setsToWin) } : {}),
      ...(patch.conferenceCount != null ? { conferenceCount: Number(patch.conferenceCount) } : {}),
      ...(patch.playoffTeams != null ? { playoffTeams: Number(patch.playoffTeams) } : {}),
      ...(patch.state ? { state: patch.state } : {}),
    },
  });
}
