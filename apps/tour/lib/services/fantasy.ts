// Fantasy service (ws08) — the shell around the pure scoring core (@balatro/tour-core
// fantasy). Managers draft real players; standings DERIVE on read from the season's sets,
// so a corrected result reflows automatically. Auth-agnostic (callers gate); the sim and
// the (future) UI/bot are thin callers of these functions.
import { prisma } from "../db";
import { snakeOrder, tallyFantasyBySlot, type SlottedSet } from "@balatro/tour-core";
import { notifyLive } from "../notify";

// One live league per season → one SSE scope. The draft board + standings page
// subscribe; every fantasy mutation notifies it post-commit.
const fantasyScope = (seasonId: string) => `fantasy:${seasonId}`;

async function seasonByName(name: string) {
  const s = await prisma.tourSeason.findUnique({ where: { name }, select: { id: true, teamSize: true } });
  if (!s) throw new Error(`No season "${name}"`);
  return s;
}

// The draftable player pool = every player on a real roster this season, with the team +
// intra-team seed they were drafted at. Sourced from DraftPick (captains self-pick, so it
// covers whole rosters). Ordered by overall pick so a fantasy auto-draft is deterministic.
export async function getFantasyPool(seasonName: string) {
  const season = await seasonByName(seasonName);
  const draft = await prisma.draft.findUnique({ where: { seasonId: season.id }, select: { id: true } });
  if (!draft) throw new Error("No draft yet — the player pool is set by the real draft.");
  const picks = await prisma.draftPick.findMany({
    where: { draftId: draft.id, playerId: { not: null } },
    orderBy: { pickIndex: "asc" },
    select: { playerId: true, teamSeasonId: true, round: true },
  });
  const players = await prisma.player.findMany({
    where: { id: { in: picks.map((p) => p.playerId!) } },
    select: { id: true, displayName: true },
  });
  const nameOf = new Map(players.map((p) => [p.id, p.displayName]));
  return picks.map((p) => ({
    playerId: p.playerId!,
    name: nameOf.get(p.playerId!) ?? p.playerId!,
    teamSeasonId: p.teamSeasonId,
    seed: p.round, // intra-team seed = draft round
  }));
}

export interface OpenFantasyInput {
  scope?: "SEASON" | "PLAYOFFS";
  rosterSize?: number; // defaults to the real teamSize
  setWinPoints?: number;
  gameWinPoints?: number;
  tradesEnabled?: boolean;
}

export async function openFantasyLeague(seasonName: string, input: OpenFantasyInput = {}) {
  const season = await seasonByName(seasonName);
  const existing = await prisma.fantasyLeague.findUnique({ where: { seasonId: season.id } });
  if (existing) throw new Error("A fantasy league already exists for this season.");
  return prisma.fantasyLeague.create({
    data: {
      seasonId: season.id,
      scope: input.scope === "PLAYOFFS" ? "PLAYOFFS" : "SEASON",
      rosterSize: Number(input.rosterSize) || season.teamSize,
      setWinPoints: input.setWinPoints ?? 1,
      gameWinPoints: input.gameWinPoints ?? 1,
      tradesEnabled: input.tradesEnabled ?? true,
    },
  });
}

export async function getFantasyLeague(seasonName: string) {
  const season = await seasonByName(seasonName);
  return prisma.fantasyLeague.findUnique({ where: { seasonId: season.id }, include: { teams: { include: { picks: true } } } });
}

// ── Live human snake draft (mirrors the real draft in lib/services/draft.ts) ──
// Managers self-serve JOIN while OPEN; the TO STARTS the draft (freezes the order);
// the on-the-clock manager PICKS from the real pool until every roster is full. No
// deadline/autopick — the clock is cosmetic ([[feedback_not_robotic]]).

// Pure on-the-clock math from the frozen order + how many picks are in (no I/O). The
// snake sequence is fully known, so the current slot is just index `madePicks` into it.
function onClockSlot(order: string[], rosterSize: number, madePicks: number) {
  const full = snakeOrder(order, rosterSize);
  if (madePicks >= full.length) return null; // board full → draft is DONE
  return {
    fantasyTeamId: full[madePicks],
    round: Math.floor(madePicks / order.length) + 1,
    overall: madePicks + 1,
    total: full.length,
  };
}

// Lock the league row for the duration of an interactive transaction, so join / remove /
// start can't interleave (Read Committed alone lets two of them both read a stale snapshot).
// The three mutators that change the roster set or freeze the order all take this lock, so a
// join can never land after the order is frozen (which would orphan a team and brick the draft).
async function lockLeague(tx: { $queryRaw: (q: TemplateStringsArray, ...v: unknown[]) => Promise<unknown> }, leagueId: string) {
  await tx.$queryRaw`SELECT id FROM "FantasyLeague" WHERE id = ${leagueId} FOR UPDATE`;
}

// A community member claims a manager slot. Any signed-in Discord user may join while the
// league is OPEN; capacity = floor(pool / rosterSize) so every manager ends with a full roster.
// The count+create runs under the league row lock, so concurrent joins can't over-subscribe
// the cap, collide on joinOrder, or slip in after the draft starts.
export async function joinFantasyLeague(seasonName: string, manager: { discordId: string; name: string }) {
  const season = await seasonByName(seasonName);
  const discordId = (manager.discordId ?? "").trim();
  if (!discordId) throw new Error("Sign in with Discord to join.");
  const base = await prisma.fantasyLeague.findUnique({ where: { seasonId: season.id }, select: { id: true, rosterSize: true } });
  if (!base) throw new Error("No fantasy league is open for this season yet.");
  const pool = await getFantasyPool(seasonName); // pool is fixed by the real draft (stable)
  const cap = Math.floor(pool.length / base.rosterSize);
  const name = ((manager.name ?? "").trim() || discordId).slice(0, 40);

  const result = await prisma.$transaction(async (tx) => {
    await lockLeague(tx, base.id);
    const league = await tx.fantasyLeague.findUnique({
      where: { id: base.id },
      include: { teams: { select: { name: true, managerDiscordId: true } } },
    });
    if (!league) throw new Error("No fantasy league is open for this season yet.");
    if (league.draftStartedAt) throw new Error("The fantasy draft has already started - the manager list is locked.");
    if (league.teams.some((t) => t.managerDiscordId === discordId)) throw new Error("You're already a manager in this league.");
    if (league.teams.length >= cap) throw new Error(`This league is full (${cap} managers for a pool of ${pool.length} at roster ${league.rosterSize}).`);
    if (league.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) throw new Error(`A manager named "${name}" is already in this league - pick another name.`);
    const team = await tx.fantasyTeam.create({
      data: { leagueId: league.id, managerDiscordId: discordId, name, joinOrder: league.teams.length + 1 },
      select: { id: true },
    });
    return { teamId: team.id, managerCount: league.teams.length + 1, cap };
  });
  await notifyLive(fantasyScope(season.id));
  return result;
}

// Drop a manager (TO only, pre-draft). Under the league lock so it can't race a start that
// would freeze the order with this team's now-deleted id (a dead id on the clock stalls the draft).
export async function removeFantasyTeam(teamId: string) {
  const team = await prisma.fantasyTeam.findUnique({
    where: { id: teamId },
    select: { id: true, league: { select: { id: true, seasonId: true } } },
  });
  if (!team) throw new Error("No such fantasy manager.");
  await prisma.$transaction(async (tx) => {
    await lockLeague(tx, team.league.id);
    const league = await tx.fantasyLeague.findUnique({ where: { id: team.league.id }, select: { draftStartedAt: true } });
    if (league?.draftStartedAt) throw new Error("The draft has started - managers can't be removed.");
    await tx.fantasyTeam.delete({ where: { id: teamId } });
  });
  await notifyLive(fantasyScope(team.league.seasonId));
}

// Lock the manager set, freeze the snake seed order (join order by default, or a TO-supplied
// permutation), and put manager #1 on the clock. Runs under the league lock and re-reads the
// team set inside the transaction, so the frozen order always covers exactly the current teams.
export async function startFantasyDraft(seasonName: string, order?: string[]) {
  const season = await seasonByName(seasonName);
  const base = await prisma.fantasyLeague.findUnique({ where: { seasonId: season.id }, select: { id: true, rosterSize: true } });
  if (!base) throw new Error("Open a fantasy league first.");
  const pool = await getFantasyPool(seasonName);
  const cap = Math.floor(pool.length / base.rosterSize);

  const result = await prisma.$transaction(async (tx) => {
    await lockLeague(tx, base.id);
    const league = await tx.fantasyLeague.findUnique({
      where: { id: base.id },
      include: { teams: { orderBy: [{ joinOrder: "asc" }, { createdAt: "asc" }], select: { id: true } } },
    });
    if (!league) throw new Error("Open a fantasy league first.");
    if (league.draftStartedAt) throw new Error("The fantasy draft has already started.");
    if (league.teams.length < 2) throw new Error("Need at least 2 managers to start the draft.");
    if (league.teams.length > cap) throw new Error(`Too many managers (${league.teams.length}) for the pool - at most ${cap}.`);

    // Frozen order: the TO's explicit list (must be exactly the current managers) or join order.
    const joinIds = league.teams.map((t) => t.id);
    let seedOrder = joinIds;
    if (order && order.length) {
      const a = [...order].sort();
      const b = [...joinIds].sort();
      if (a.length !== b.length || a.some((x, i) => x !== b[i])) throw new Error("Draft order must list exactly the current managers.");
      seedOrder = order;
    }
    const now = new Date();
    await tx.fantasyLeague.update({
      where: { id: league.id },
      data: { draftStartedAt: now, orderJson: JSON.stringify(seedOrder), onClockSince: now },
    });
    return { teams: seedOrder.length, totalPicks: seedOrder.length * base.rosterSize };
  });
  await notifyLive(fantasyScope(season.id));
  return result;
}

// Who is on the clock right now (or null if not started / draft complete).
export async function onClockFantasyTeam(seasonName: string) {
  const season = await seasonByName(seasonName);
  const league = await prisma.fantasyLeague.findUnique({
    where: { seasonId: season.id },
    include: { teams: { select: { id: true, managerDiscordId: true, _count: { select: { picks: true } } } } },
  });
  if (!league || !league.draftStartedAt || !league.orderJson) return null;
  const order = JSON.parse(league.orderJson) as string[];
  const madePicks = league.teams.reduce((n, t) => n + t._count.picks, 0);
  const slot = onClockSlot(order, league.rosterSize, madePicks);
  if (!slot) return null;
  const team = league.teams.find((t) => t.id === slot.fantasyTeamId);
  if (!team) return null;
  return { fantasyTeamId: slot.fantasyTeamId, managerDiscordId: team.managerDiscordId, round: slot.round, overall: slot.overall };
}

// One live pick. `actorDiscordId` is the signed-in manager (from getViewer — NEVER a form
// field). Enforces the three correctness properties the schema can't: turn order + ownership
// (only the on-clock manager), league-wide unique player ownership, and no double-pick (the
// [fantasyTeamId,pickIndex] unique index serializes concurrent submits → P2002).
export async function makeFantasyPick(seasonName: string, actorDiscordId: string, playerId: string) {
  const season = await seasonByName(seasonName);
  const actor = (actorDiscordId ?? "").trim();
  if (!actor) throw new Error("Sign in with Discord to draft.");

  const league = await prisma.fantasyLeague.findUnique({
    where: { seasonId: season.id },
    include: { teams: { select: { id: true, managerDiscordId: true } } },
  });
  if (!league) throw new Error("No fantasy league for this season.");
  if (!league.draftStartedAt || !league.orderJson) throw new Error("The fantasy draft hasn't started yet.");

  // The pool is fixed by the real draft; look up the player's slot (real team + seed).
  const pool = await getFantasyPool(seasonName);
  const poolEntry = pool.find((p) => p.playerId === playerId);
  if (!poolEntry) throw new Error("That player isn't in the draft pool.");
  const order = JSON.parse(league.orderJson) as string[];

  let done: boolean;
  try {
    done = await prisma.$transaction(async (tx) => {
      const picks = await tx.fantasyPick.findMany({ where: { team: { leagueId: league.id } }, select: { playerId: true } });
      const madePicks = picks.length;
      const slot = onClockSlot(order, league.rosterSize, madePicks);
      if (!slot) throw new Error("The fantasy draft is already complete.");
      const onClock = league.teams.find((t) => t.id === slot.fantasyTeamId);
      if (!onClock || onClock.managerDiscordId !== actor) throw new Error("It's not your turn to pick.");
      if (picks.some((p) => p.playerId === playerId)) throw new Error("That player is already drafted.");

      await tx.fantasyPick.create({
        data: { fantasyTeamId: slot.fantasyTeamId, pickIndex: madePicks, playerId, teamSeasonId: poolEntry.teamSeasonId, seed: poolEntry.seed },
      });
      await tx.fantasyLeague.update({ where: { id: league.id }, data: { onClockSince: new Date() } });
      return madePicks + 1 >= slot.total;
    });
  } catch (e) {
    // Two submits raced onto the same slot — the unique index rejected the loser.
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      throw new Error("That pick was just taken — refresh the board.");
    }
    throw e;
  }

  await notifyLive(fantasyScope(season.id));
  return { done };
}

// Live board read model (mirrors getDraft): teams with their picks, the remaining pool, who's
// on the clock, and the up-next ticker. null when no league exists.
export async function getFantasyDraftBoard(seasonName: string) {
  const season = await seasonByName(seasonName);
  const league = await prisma.fantasyLeague.findUnique({
    where: { seasonId: season.id },
    include: {
      teams: {
        orderBy: [{ joinOrder: "asc" }, { createdAt: "asc" }],
        include: { picks: { orderBy: { pickIndex: "asc" }, select: { pickIndex: true, playerId: true, teamSeasonId: true, seed: true } } },
      },
    },
  });
  if (!league) return null;

  const pool = await getFantasyPool(seasonName); // {playerId,name,teamSeasonId,seed}
  const rosterSize = league.rosterSize;
  const cap = Math.floor(pool.length / rosterSize);
  const teamCount = league.teams.length;
  const total = teamCount * rosterSize;
  const madePicks = league.teams.reduce((n, t) => n + t.picks.length, 0);
  const state: "OPEN" | "DRAFTING" | "DONE" = !league.draftStartedAt ? "OPEN" : madePicks >= total ? "DONE" : "DRAFTING";

  // Names: the pool covers undrafted players; drafted ones are gone from it, so resolve them.
  const poolNameById = new Map(pool.map((p) => [p.playerId, p.name]));
  const pickedIds = league.teams.flatMap((t) => t.picks.map((p) => p.playerId));
  const missing = pickedIds.filter((id) => !poolNameById.has(id));
  const extra = missing.length ? await prisma.player.findMany({ where: { id: { in: missing } }, select: { id: true, displayName: true } }) : [];
  const nameById = new Map<string, string>(poolNameById);
  for (const p of extra) nameById.set(p.id, p.displayName);

  // Real-team names for the "from" label on each pick.
  const tsIds = [...new Set(pickedIds.length ? league.teams.flatMap((t) => t.picks.map((p) => p.teamSeasonId)) : [])];
  const teamSeasons = tsIds.length ? await prisma.teamSeason.findMany({ where: { id: { in: tsIds } }, include: { team: { select: { name: true } } } }) : [];
  const realTeamName = new Map(teamSeasons.map((ts) => [ts.id, ts.team.name]));

  const order = league.orderJson ? (JSON.parse(league.orderJson) as string[]) : league.teams.map((t) => t.id);
  const slot = league.draftStartedAt ? onClockSlot(order, rosterSize, madePicks) : null;

  const teams = league.teams.map((t) => ({
    id: t.id,
    name: t.name,
    managerDiscordId: t.managerDiscordId,
    joinOrder: t.joinOrder,
    onClock: slot?.fantasyTeamId === t.id,
    picks: t.picks.map((p) => ({
      pickIndex: p.pickIndex,
      playerId: p.playerId,
      name: nameById.get(p.playerId) ?? p.playerId,
      seed: p.seed,
      teamName: realTeamName.get(p.teamSeasonId) ?? "",
    })),
  }));

  const taken = new Set(pickedIds);
  const boardPool = pool.filter((p) => !taken.has(p.playerId));

  const currentTeam = slot ? teams.find((t) => t.id === slot.fantasyTeamId) ?? null : null;
  const current = slot && currentTeam
    ? { fantasyTeamId: currentTeam.id, managerDiscordId: currentTeam.managerDiscordId, managerName: currentTeam.name, round: slot.round, overall: slot.overall, onClockSince: league.onClockSince }
    : null;

  const full = league.draftStartedAt ? snakeOrder(order, rosterSize) : [];
  const nameByTeamId = new Map(teams.map((t) => [t.id, t.name]));
  const upcoming = full.slice(madePicks + 1, madePicks + 6).map((tid, i) => ({ overall: madePicks + 2 + i, managerName: nameByTeamId.get(tid) ?? "?" }));

  return { seasonId: season.id, state, rosterSize, cap, teams, current, upcoming, pool: boardPool, totalPicks: total, madePicks };
}

// Snake auto-draft: assign the pool to `managers` in serpentine order until each has a full
// roster. Unique ownership; max managers is bounded so the pool divides evenly (rosterSize x
// managers <= pool). Used by the sim and as the "autopick" fallback for the real draft.
export async function autoDraftFantasy(seasonName: string, managers: { discordId: string; name: string }[]) {
  const league = await getFantasyLeague(seasonName);
  if (!league) throw new Error("Open a fantasy league first.");
  if (league.teams.length) throw new Error("This fantasy league has already drafted.");
  const pool = await getFantasyPool(seasonName);
  const maxManagers = Math.floor(pool.length / league.rosterSize);
  if (managers.length < 2) throw new Error("Need at least 2 fantasy managers.");
  if (managers.length > maxManagers) throw new Error(`At most ${maxManagers} managers (pool of ${pool.length} ÷ roster ${league.rosterSize}).`);

  const teams = await Promise.all(
    managers.map((m, i) => prisma.fantasyTeam.create({ data: { leagueId: league.id, managerDiscordId: m.discordId, name: m.name, joinOrder: i + 1 } })),
  );
  // Serpentine order over teams for rosterSize rounds → overall pick sequence.
  const seedOrder = teams.map((t) => t.id);
  const order = snakeOrder(seedOrder, league.rosterSize);
  await prisma.fantasyPick.createMany({
    data: order.map((fantasyTeamId, pickIndex) => {
      const p = pool[pickIndex];
      return { fantasyTeamId, pickIndex, playerId: p.playerId, teamSeasonId: p.teamSeasonId, seed: p.seed };
    }),
  });
  // Mark the (already-complete) draft as started so the board reads DONE, not OPEN.
  const now = new Date();
  await prisma.fantasyLeague.update({ where: { id: league.id }, data: { draftStartedAt: now, orderJson: JSON.stringify(seedOrder), onClockSince: now } });
  return { league: league.id, managers: teams.length, picks: order.length };
}

// Cumulative standings — derive on read. Loads the in-scope decided sets, maps each set's
// real players to their fantasy owner, and tallies via the pure core. SEASON = every set;
// PLAYOFFS = only playoff-week sets (eliminated players simply have no more sets).
export async function getFantasyStandings(seasonName: string) {
  const season = await seasonByName(seasonName);
  const league = await prisma.fantasyLeague.findUnique({
    where: { seasonId: season.id },
    include: { teams: { include: { picks: { select: { playerId: true, teamSeasonId: true, seed: true } } } } },
  });
  if (!league) return null;

  // Two lookups for the slot-aware tally: by drafted player (identity, re-seed-safe) and by
  // the drafted seed slot (so a sub/replacement's points flow to that slot's owner). Keyed
  // on the fantasy TEAM ID (not name) — two managers may share a display name and must stay
  // distinct rows; name/discordId are carried through only for display.
  const ownerByPlayer = new Map<string, string>();
  const ownerBySlot = new Map<string, string>(); // key `${teamSeasonId}:${seed}`
  for (const t of league.teams) {
    for (const pk of t.picks) {
      ownerByPlayer.set(pk.playerId, t.id);
      ownerBySlot.set(`${pk.teamSeasonId}:${pk.seed}`, t.id);
    }
  }

  // In-scope decided sets (have a linked core Match). Playoff scope filters by week kind.
  const sets = await prisma.tourSet.findMany({
    where: {
      matchId: { not: null },
      OR: [{ seasonId: season.id }, { matchup: { week: { seasonId: season.id } } }],
      ...(league.scope === "PLAYOFFS" ? { matchup: { week: { kind: "PLAYOFF" } } } : {}),
    },
    select: {
      playerAId: true, playerBId: true, seedA: true, seedB: true,
      teamSeasonAId: true, teamSeasonBId: true, matchId: true,
      // Live sets carry their team link on the matchup (the set's own columns are for
      // historical imports); set side A == matchup team A (schema §TourSet).
      matchup: { select: { teamSeasonAId: true, teamSeasonBId: true } },
    },
  });
  const matches = await prisma.match.findMany({
    where: { id: { in: sets.map((s) => s.matchId!).filter(Boolean) }, status: "CONFIRMED" },
    select: { id: true, playerAId: true, playerBId: true, gamesWonA: true, gamesWonB: true },
  });
  const matchById = new Map(matches.map((m) => [m.id, m]));

  // Enrich each set with the game counts (Match A/B are canonical-by-id, not the set's A/B)
  // and the seed slots for the slot-aware owner resolution. Sets missing a team/slot are
  // skipped (historical/team-only imports have no per-side seed).
  const slotted: SlottedSet[] = [];
  for (const s of sets) {
    const m = s.matchId ? matchById.get(s.matchId) : undefined;
    const teamA = s.teamSeasonAId ?? s.matchup?.teamSeasonAId ?? null;
    const teamB = s.teamSeasonBId ?? s.matchup?.teamSeasonBId ?? null;
    if (!m || teamA == null || teamB == null) continue;
    const gamesFor = (playerId: string) => (m.playerAId === playerId ? m.gamesWonA : m.playerBId === playerId ? m.gamesWonB : 0);
    slotted.push({
      playerAId: s.playerAId, teamSeasonAId: teamA, seedA: s.seedA, gamesA: gamesFor(s.playerAId),
      playerBId: s.playerBId, teamSeasonBId: teamB, seedB: s.seedB, gamesB: gamesFor(s.playerBId),
    });
  }

  const totals = tallyFantasyBySlot(
    slotted,
    (pid) => ownerByPlayer.get(pid) ?? null,
    (tid, seed) => ownerBySlot.get(`${tid}:${seed}`) ?? null,
    { setWinPoints: league.setWinPoints, gameWinPoints: league.gameWinPoints },
  );
  // Include managers with 0 points (drafted players who haven't scored yet). Points/sets
  // come from the id-keyed tally; name/discordId are for display.
  const scored = new Map(totals.map((t) => [t.managerId, t]));
  const standings = league.teams
    .map((t) => {
      const s = scored.get(t.id);
      return {
        teamId: t.id,
        managerName: t.name,
        managerDiscordId: t.managerDiscordId,
        points: s?.points ?? 0,
        sets: s?.sets ?? 0,
      };
    })
    .sort((a, b) => b.points - a.points || a.managerName.localeCompare(b.managerName));

  return { scope: league.scope, rosterSize: league.rosterSize, standings, setsCounted: slotted.length };
}

// Remove the fantasy league for a season (called by deleteSeason — plain-id, no cascade).
export async function deleteFantasyForSeason(seasonId: string) {
  await prisma.fantasyLeague.deleteMany({ where: { seasonId } });
}
