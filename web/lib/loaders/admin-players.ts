// Admin players + division loaders: players list / division view /
// division detail / divisions index. Relocated verbatim from admin.ts
// (no behavior change).
//
// Conventions:
//   - All admin loaders assume requireAdmin() ran in the page
//   - Return shapes are page-specific; never expose raw Prisma types
//   - Cached standings come from loadDivisionStandings, not inline
//     computeStandings

import { prisma } from "@/lib/prisma";
import { isScheduleLocked } from "@/lib/schedule-locked";
import { computeStandings } from "@/lib/standings";
import { formatSeasonLabel } from "@/lib/format-season";
import { expectedMatchesBySeason } from "@/lib/loaders/admin-shared";

// ── /admin/divisions (index) ─────────────────────────────────────────

export interface AdminDivisionsTier {
  id: string;
  name: string;
  position: number;
  divisions: Array<{
    id: string;
    name: string;
    memberCount: number;
    targetSize: number;
    confirmedPairingCount: number;
    expectedPairingCount: number;
    roundRobin: boolean | null; // null = use the season default (top-N rule)
  }>;
}

export interface AdminDivisionsPageData {
  season: { id: string; name: string; targetGroupSize: number; scheduleLocked: boolean } | null;
  tiers: AdminDivisionsTier[];
}

// ── /admin/players ───────────────────────────────────────────────────

export interface AdminDivisionMemberRow {
  membershipId: string;
  playerId: string;
  displayName: string;
  discordId: string;
  username: string | null;
  rating: number | null;
  droppedAt: Date | null;
  status: "ACTIVE" | "DROPPED";
  rank: number | null;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  unplayedOpponents: Array<{ playerId: string; displayName: string }>;
}

export interface AdminPlayersDivisionView {
  division: {
    id: string;
    name: string;
    seasonId: string;
    seasonName: string;
    tierName: string;
    tierPosition: number;
  };
  active: AdminDivisionMemberRow[];
  inactive: AdminDivisionMemberRow[];
}

export async function loadAdminPlayersDivisionView(
  divisionId: string,
): Promise<AdminPlayersDivisionView | null> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      season: { select: { id: true, number: true, subtitle: true, scheduleLocked: true } },
      tier: { select: { name: true, position: true } },
      members: { include: { player: true } },
      matches: {
        where: { format: "LEAGUE_BO2" },
        select: { playerAId: true, playerBId: true, gamesWonA: true, gamesWonB: true, status: true },
      },
    },
  });
  if (!division) return null;

  const confirmedMatches = division.matches.filter((m) => m.status === "CONFIRMED");
  const standings = computeStandings(
    division.members.map((m) => m.player),
    confirmedMatches,
  );
  const standingByPlayer = new Map(
    standings.map((r, i) => [r.player.id, { rank: i + 1, points: r.points, wins: r.wins, draws: r.draws, losses: r.losses }]),
  );

  const active = division.members.filter((m) => m.status === "ACTIVE");
  const rowFor = (m: typeof division.members[number]): AdminDivisionMemberRow => {
    const s = standingByPlayer.get(m.playerId);
    const mine = division.matches.filter((p) => p.playerAId === m.playerId || p.playerBId === m.playerId);
    const oppOf = (p: (typeof mine)[number]) => (p.playerAId === m.playerId ? p.playerBId : p.playerAId);
    const playedThisPlayer = new Set(mine.filter((p) => p.status === "CONFIRMED").map(oppOf));
    const assignedThisPlayer = new Set(mine.map(oppOf)); // any status = on their schedule
    // Flag OR the ground truth (a pre-created 0-0 PENDING match exists) — so a
    // stale/false flag can't fall this back to a full round-robin.
    const locked = isScheduleLocked(division.season.scheduleLocked, division.matches);
    const unplayed = active
      .filter(
        (o) =>
          o.playerId !== m.playerId &&
          !playedThisPlayer.has(o.playerId) &&
          (!locked || assignedThisPlayer.has(o.playerId)),
      )
      .map((o) => ({ playerId: o.playerId, displayName: o.player.displayName }));
    return {
      membershipId: m.id,
      playerId: m.playerId,
      displayName: m.player.displayName,
      discordId: m.player.discordId,
      username: m.player.username,
      rating: m.player.rating,
      droppedAt: m.droppedAt,
      status: m.status,
      rank: s?.rank ?? null,
      points: s?.points ?? 0,
      wins: s?.wins ?? 0,
      draws: s?.draws ?? 0,
      losses: s?.losses ?? 0,
      unplayedOpponents: unplayed,
    };
  };

  return {
    division: {
      id: division.id,
      name: division.name,
      seasonId: division.season.id,
      seasonName: formatSeasonLabel(division.season),
      tierName: division.tier.name,
      tierPosition: division.tier.position,
    },
    active: division.members.filter((m) => m.status === "ACTIVE").map(rowFor),
    inactive: division.members.filter((m) => m.status === "DROPPED").map(rowFor),
  };
}

export type AdminPlayersListSort = "name" | "rating-desc" | "rating-asc" | "ranked-only" | "unranked-only";

export interface AdminPlayersListRow {
  id: string;
  displayName: string;
  discordId: string;
  username: string | null;
  rating: number | null;
  membership: {
    divisionId: string;
    divisionName: string;
    seasonId: string;
    tierPosition: number;
    dropped: boolean;
    unplayedOpponents: Array<{ playerId: string; displayName: string }>;
  } | null;
}

export async function loadAdminPlayersListView(opts: {
  seasonId?: string;
  sort: AdminPlayersListSort;
}): Promise<AdminPlayersListRow[]> {
  const selectedSeason = opts.seasonId
    ? await prisma.season.findUnique({ where: { id: opts.seasonId }, select: { id: true, scheduleLocked: true } })
    : await prisma.season.findFirst({ where: { isActive: true }, select: { id: true, scheduleLocked: true } });

  const players = await prisma.player.findMany({
    select: {
      id: true,
      discordId: true,
      username: true,
      displayName: true,
      rating: true,
      memberships: {
        where: selectedSeason
          ? { division: { seasonId: selectedSeason.id } }
          : { division: { season: { isActive: true } } },
        select: {
          status: true,
          division: {
            select: {
              id: true,
              name: true,
              seasonId: true,
              tier: { select: { position: true } },
            },
          },
        },
      },
    },
  });
  let filtered = players;
  // When a season is selected, restrict to its members; otherwise show
  // every player (the active-season filter on memberships still trims
  // the badge column for non-current players).
  if (opts.seasonId) filtered = players.filter((p) => p.memberships.length > 0);

  // For the inline "Record set vs ..." form per row, pre-compute the
  // unplayed opponents for each (player, division) in one batch — avoids
  // a per-row roundtrip.
  const unplayedByKey = new Map<string, Array<{ playerId: string; displayName: string }>>();
  if (selectedSeason) {
    const members = await prisma.divisionMember.findMany({
      where: { seasonId: selectedSeason.id, status: "ACTIVE" },
      select: { divisionId: true, playerId: true, player: { select: { id: true, displayName: true } } },
    });
    const membersByDivision = new Map<string, Array<{ playerId: string; displayName: string }>>();
    for (const m of members) {
      const bucket = membersByDivision.get(m.divisionId) ?? [];
      bucket.push({ playerId: m.playerId, displayName: m.player.displayName });
      membersByDivision.set(m.divisionId, bucket);
    }
    const pairings = await prisma.match.findMany({
      where: { format: "LEAGUE_BO2", division: { seasonId: selectedSeason.id } },
      select: { divisionId: true, playerAId: true, playerBId: true, status: true, gamesWonA: true, gamesWonB: true },
    });
    const pairKey = (divisionId: string, a: string, b: string) =>
      `${divisionId}|${a < b ? `${a}-${b}` : `${b}-${a}`}`;
    const playedSet = new Set<string>(); // CONFIRMED pairs
    const assignedSet = new Set<string>(); // any-status pairs = on the schedule
    // Flag OR the ground truth (a pre-created 0-0 PENDING match exists).
    const locked = isScheduleLocked(selectedSeason.scheduleLocked, pairings);
    for (const p of pairings) {
      const k = pairKey(p.divisionId, p.playerAId, p.playerBId);
      assignedSet.add(k);
      if (p.status === "CONFIRMED") playedSet.add(k);
    }
    for (const [divisionId, list] of membersByDivision) {
      for (const meId of list.map((m) => m.playerId)) {
        const unplayed = list.filter((m) => {
          if (m.playerId === meId) return false;
          const k = pairKey(divisionId, meId, m.playerId);
          if (playedSet.has(k)) return false;
          // Locked schedule: only the opponents actually on their schedule.
          return !locked || assignedSet.has(k);
        });
        unplayedByKey.set(`${divisionId}|${meId}`, unplayed);
      }
    }
  }

  // Apply sort + filter modes.
  let result = filtered.map((p): AdminPlayersListRow => {
    const m = p.memberships[0];
    const div = m?.division;
    return {
      id: p.id,
      displayName: p.displayName,
      discordId: p.discordId,
      username: p.username,
      rating: p.rating,
      membership: div
        ? {
            divisionId: div.id,
            divisionName: div.name,
            seasonId: div.seasonId,
            tierPosition: div.tier.position,
            dropped: m!.status === "DROPPED",
            unplayedOpponents: unplayedByKey.get(`${div.id}|${p.id}`) ?? [],
          }
        : null,
    };
  });
  if (opts.sort === "ranked-only") result = result.filter((p) => p.rating != null);
  if (opts.sort === "unranked-only") result = result.filter((p) => p.rating == null);
  if (opts.sort === "rating-desc") {
    result.sort((a, b) => (b.rating ?? -1) - (a.rating ?? -1) || a.displayName.localeCompare(b.displayName));
  } else if (opts.sort === "rating-asc") {
    result.sort((a, b) => (a.rating ?? -1) - (b.rating ?? -1) || a.displayName.localeCompare(b.displayName));
  } else {
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
  return result;
}

// ── /admin/divisions/[id] ────────────────────────────────────────────

export interface AdminDivisionDetailMember {
  id: string;
  playerId: string;
  status: "ACTIVE" | "DROPPED";
  droppedAt: Date | null;
  player: { id: string; displayName: string; discordId: string; rating: number | null };
}

export interface AdminDivisionDetailPairing {
  id: string;
  status: "PENDING" | "CONFIRMED" | "DISPUTED" | "CANCELLED";
  playerAId: string;
  playerBId: string;
  gamesWonA: number;
  gamesWonB: number;
  reportedAt: Date | null;
  confirmedAt: Date | null;
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string };
}

export interface AdminDivisionDetailShootout {
  playerAId: string;
  playerBId: string;
  winnerId: string;
  recordedBy: string;
  recordedAt: Date;
  notes: string | null;
}

export interface AdminDivisionDetailData {
  division: {
    id: string;
    name: string;
    targetSize: number | null;
    seasonId: string;
    seasonName: string;
    seasonTargetGroupSize: number;
    tierName: string;
    tierPosition: number;
  };
  members: AdminDivisionDetailMember[];
  pairings: AdminDivisionDetailPairing[];
  shootouts: AdminDivisionDetailShootout[];
  standings: Array<ReturnType<typeof computeStandings>[number] & { dropped: boolean }>;
  unplayed: Array<{
    a: { id: string; displayName: string };
    b: { id: string; displayName: string };
  }>;
  playerById: Map<string, { id: string; displayName: string }>;
  // Net life differential per player across the division's regular-season
  // games: +winnerLives when they won a game, −winnerLives when an opponent
  // beat them. A reference for MANUALLY breaking a 3+-way tie — not applied
  // automatically. Only games captured through the guided flow contribute
  // (others have null winnerLives).
  lifeDiffByPlayer: Record<string, number>;
}

export async function loadAdminDivisionDetail(
  divisionId: string,
): Promise<AdminDivisionDetailData | null> {
  const division = await prisma.division.findUnique({
    where: { id: divisionId },
    include: {
      season: { select: { id: true, number: true, subtitle: true, targetGroupSize: true } },
      tier: { select: { name: true, position: true } },
      members: { include: { player: true }, orderBy: { joinedAt: "asc" } },
      matches: {
        include: { playerA: true, playerB: true },
        orderBy: [{ status: "asc" }, { reportedAt: "desc" }],
      },
    },
  });
  if (!division) return null;

  // Split the unified matches back into BO2 "pairings" and shootouts for
  // the existing view shape.
  const pairings = division.matches.filter((m) => m.format === "LEAGUE_BO2");
  const shootoutMatches = division.matches.filter((m) => m.format === "SHOOTOUT_BO1");
  const shootouts = shootoutMatches
    .filter((s) => s.winnerId !== null)
    .map((s) => ({
      playerAId: s.playerAId,
      playerBId: s.playerBId,
      winnerId: s.winnerId!,
      recordedBy: s.recordedBy ?? "unknown",
      recordedAt: s.confirmedAt ?? s.createdAt,
      notes: s.notes,
    }));

  const droppedIds = new Set(
    division.members.filter((m) => m.status === "DROPPED").map((m) => m.playerId),
  );
  const confirmedPairings = pairings.filter((p) => p.status === "CONFIRMED");
  const standings = computeStandings(
    division.members.map((m) => m.player),
    confirmedPairings.map((p) => ({
      playerAId: p.playerAId,
      playerBId: p.playerBId,
      gamesWonA: p.gamesWonA,
      gamesWonB: p.gamesWonB,
    })),
    shootoutMatches
      .filter((s) => s.winnerId !== null)
      .map((s) => ({ playerAId: s.playerAId, playerBId: s.playerBId, winnerId: s.winnerId! })),
  ).map((r) => ({ ...r, dropped: droppedIds.has(r.player.id) }));

  const playerById = new Map(
    division.members.map((m) => [m.playerId, { id: m.player.id, displayName: m.player.displayName }]),
  );

  // Net life differential per player (reference for manual tie-breaking).
  // Only confirmed regular-season (BO2) games with a captured winnerLives.
  const livesGames = await prisma.game.findMany({
    where: {
      winnerId: { not: null },
      winnerLives: { not: null },
      match: { divisionId, status: "CONFIRMED", format: "LEAGUE_BO2" },
    },
    select: { winnerId: true, winnerLives: true, match: { select: { playerAId: true, playerBId: true } } },
  });
  const lifeDiffByPlayer: Record<string, number> = {};
  for (const g of livesGames) {
    const winner = g.winnerId!;
    const lives = g.winnerLives!;
    const loser = g.match.playerAId === winner ? g.match.playerBId : g.match.playerAId;
    lifeDiffByPlayer[winner] = (lifeDiffByPlayer[winner] ?? 0) + lives;
    lifeDiffByPlayer[loser] = (lifeDiffByPlayer[loser] ?? 0) - lives;
  }

  const activeMembers = division.members.filter((m) => m.status === "ACTIVE");
  const playedKey = (a: string, b: string) => {
    const [x, y] = a < b ? [a, b] : [b, a];
    return `${x}-${y}`;
  };
  const playedSet = new Set(pairings.map((p) => playedKey(p.playerAId, p.playerBId)));
  const unplayed: AdminDivisionDetailData["unplayed"] = [];
  for (let i = 0; i < activeMembers.length; i++) {
    for (let j = i + 1; j < activeMembers.length; j++) {
      const a = activeMembers[i]!.player;
      const b = activeMembers[j]!.player;
      if (!playedSet.has(playedKey(a.id, b.id))) {
        unplayed.push({ a, b });
      }
    }
  }

  return {
    division: {
      id: division.id,
      name: division.name,
      targetSize: division.targetSize,
      seasonId: division.season.id,
      seasonName: formatSeasonLabel(division.season),
      seasonTargetGroupSize: division.season.targetGroupSize,
      tierName: division.tier.name,
      tierPosition: division.tier.position,
    },
    members: division.members.map((m): AdminDivisionDetailMember => ({
      id: m.id,
      playerId: m.playerId,
      status: m.status,
      droppedAt: m.droppedAt,
      player: {
        id: m.player.id,
        displayName: m.player.displayName,
        discordId: m.player.discordId,
        rating: m.player.rating,
      },
    })),
    pairings: pairings.map((p): AdminDivisionDetailPairing => ({
      id: p.id,
      status: p.status,
      playerAId: p.playerAId,
      playerBId: p.playerBId,
      gamesWonA: p.gamesWonA,
      gamesWonB: p.gamesWonB,
      reportedAt: p.reportedAt,
      confirmedAt: p.confirmedAt,
      playerA: { id: p.playerA.id, displayName: p.playerA.displayName },
      playerB: { id: p.playerB.id, displayName: p.playerB.displayName },
    })),
    shootouts,
    standings,
    unplayed,
    playerById,
    lifeDiffByPlayer,
  };
}

export async function loadAdminDivisionsIndex(): Promise<AdminDivisionsPageData> {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      number: true,
      subtitle: true,
      targetGroupSize: true,
      scheduleLocked: true,
      tiers: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          divisions: {
            orderBy: { groupNumber: "asc" },
            select: {
              id: true,
              name: true,
              targetSize: true,
              roundRobin: true,
              members: { select: { status: true, playerId: true } },
              matches: { where: { status: "CONFIRMED", format: "LEAGUE_BO2" }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!season) return { season: null, tiers: [] };
  // Schedule-aware expected counts so a locked (graph) division's progress bar
  // can reach 100% instead of being measured against a full round-robin.
  const activeByDivision = new Map(
    season.tiers.flatMap((t) =>
      t.divisions.map(
        (d) => [d.id, new Set(d.members.filter((m) => m.status === "ACTIVE").map((m) => m.playerId))] as const,
      ),
    ),
  );
  const expectedByDivision = await expectedMatchesBySeason(season.id, activeByDivision, season.scheduleLocked);
  const tiers: AdminDivisionsTier[] = season.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    position: t.position,
    divisions: t.divisions.map((d) => {
      return {
        id: d.id,
        name: d.name,
        memberCount: d.members.length,
        targetSize: d.targetSize ?? season.targetGroupSize,
        confirmedPairingCount: d.matches.length,
        expectedPairingCount: expectedByDivision.get(d.id) ?? 0,
        roundRobin: d.roundRobin,
      };
    }),
  }));
  return {
    season: { id: season.id, name: formatSeasonLabel(season), targetGroupSize: season.targetGroupSize, scheduleLocked: season.scheduleLocked },
    tiers,
  };
}
