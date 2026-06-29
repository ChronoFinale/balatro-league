// Identity service — link a Tour player to a real Discord id (picked from the
// league reference) and merge duplicate players. Pure logic; the admin UI/actions
// gate. Player.id is referenced by plain id everywhere (decoupling rule), so merge
// repoints each place by hand inside one transaction.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../db";
import { leaguePlayersLive } from "../league-db";

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");
export interface LeagueRefRow { discordId: string; name: string }

// The base league name→Discord-id reference (display names + @usernames), best
// source first:
//   1. LIVE league DB (LEAGUE_DATABASE_URL, read-only) — always current.
//   2. LeagueRef table, league rows (populated from an uploaded league-players.csv).
//   3. local league-players.csv file (dev convenience).
async function getLeagueRef(): Promise<LeagueRefRow[]> {
  try {
    const live = await leaguePlayersLive();
    if (live && live.length > 0) return live;
  } catch {
    /* live league DB unreachable — fall back to the snapshot sources */
  }
  const rows = await prisma.leagueRef.findMany({ where: { source: "league" }, select: { discordId: true, name: true } });
  if (rows.length > 0) return rows;
  const path = join(process.cwd(), "league-players.csv");
  if (!existsSync(path)) return [];
  return parseLeagueCsv(readFileSync(path, "utf8"));
}

function parseLeagueCsv(csv: string): LeagueRefRow[] {
  const lines = csv.replace(/\r/g, "").split("\n").filter(Boolean);
  if (lines[0]?.toLowerCase().startsWith("name")) lines.shift(); // header
  return lines
    .map((line) => {
      const last = line.lastIndexOf(",");
      return { name: line.slice(0, last).trim(), discordId: line.slice(last + 1).trim() };
    })
    .filter((r) => r.discordId && /^\d+$/.test(r.discordId));
}

// Upsert one (discordId, name) into the LeagueRef table without duplicating.
async function upsertRef(discordId: string, name: string, source: string) {
  await prisma.leagueRef.upsert({
    where: { discordId_name: { discordId, name } },
    create: { discordId, name, source },
    update: { source },
  });
}

// Populate/refresh the LeagueRef table from a CSV string. Stores every name row
// (display name AND @username — multiple per person), source "league". Idempotent.
export async function loadLeagueRefFromCsv(csv: string): Promise<{ count: number }> {
  const rows = parseLeagueCsv(csv);
  for (const r of rows) await upsertRef(r.discordId, r.name, "league");
  return { count: new Set(rows.map((r) => r.discordId)).size };
}

// Resolve uploaded signups (preferred name → Discord @username) against the league
// username→discordId map, and store each resolved preferred-name as a LeagueRef row
// (source "signup"). This is what used to be the baked SIGNUP_USERNAMES table — now
// derived at import time from the season xlsx. Returns how many resolved.
export async function applySignupRefs(signups: { preferredName: string; username: string }[]): Promise<{ resolved: number; unresolved: number }> {
  const league = await getLeagueRef();
  const idByName = new Map<string, string>(); // normalized league name (display or username) → discordId
  for (const r of league) if (!idByName.has(norm(r.name))) idByName.set(norm(r.name), r.discordId);

  let resolved = 0, unresolved = 0;
  for (const s of signups) {
    const discordId = idByName.get(norm(s.username));
    if (!discordId) { unresolved++; continue; }
    await upsertRef(discordId, s.preferredName, "signup");
    resolved++;
  }
  return { resolved, unresolved };
}

export async function leagueRefCount(): Promise<number> {
  return new Set((await getLeagueRef()).map((r) => r.discordId)).size;
}

// Dedup-by-id + cap.
function dedup(rows: LeagueRefRow[], limit: number): LeagueRefRow[] {
  const seen = new Set<string>();
  const out: LeagueRefRow[] = [];
  for (const r of rows) {
    if (seen.has(r.discordId)) continue;
    seen.add(r.discordId);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

// Rank league rows by how well they match a name: exact → starts-with → contains.
function rankMatches(name: string, all: LeagueRefRow[], limit: number): LeagueRefRow[] {
  const t = norm(name);
  if (!t) return [];
  const exact: LeagueRefRow[] = [], starts: LeagueRefRow[] = [], incl: LeagueRefRow[] = [];
  for (const r of all) {
    const n = norm(r.name);
    if (n === t) exact.push(r);
    else if (n.startsWith(t) || t.startsWith(n)) starts.push(r);
    else if (n.includes(t) || t.includes(n)) incl.push(r);
  }
  return dedup([...exact, ...starts, ...incl], limit);
}

// The reference used for suggestions/search: the live league rows PLUS every stored
// LeagueRef row (league display-names/usernames + signup-resolved preferred names).
// Multiple name rows per person are fine — rankMatches dedups the winners by id.
async function getSuggestRef(): Promise<LeagueRefRow[]> {
  const out: LeagueRefRow[] = [];
  try {
    const live = await leaguePlayersLive();
    if (live?.length) out.push(...live);
  } catch {
    /* live league DB unreachable — table rows below still cover it */
  }
  const table = await prisma.leagueRef.findMany({ select: { discordId: true, name: true } });
  out.push(...table);
  if (out.length) return out;
  const path = join(process.cwd(), "league-players.csv");
  if (existsSync(path)) return parseLeagueCsv(readFileSync(path, "utf8"));
  return [];
}

// The link picker (free-text search of the league list + signup-resolved names).
export async function searchLeagueRef(q: string, limit = 25): Promise<LeagueRefRow[]> {
  const all = await getSuggestRef();
  const needle = norm(q);
  return dedup(needle ? all.filter((r) => norm(r.name).includes(needle)) : all, limit);
}

export async function identityCounts() {
  const [total, linked] = await Promise.all([
    prisma.player.count(),
    prisma.player.count({ where: { NOT: { discordId: { startsWith: "legacy:" } } } }),
  ]);
  return { total, linked, unlinked: total - linked };
}

export interface TourPlayerRow {
  id: string;
  name: string;
  discordId: string;
  linked: boolean;
  sets: number;
  seasons: number;
  suggestions?: LeagueRefRow[]; // likely league matches (unlinked players only)
}

export type IdentityFilter = "all" | "unlinked" | "linked";

export async function listTourPlayers(q = "", limit = 60, filter: IdentityFilter = "all"): Promise<TourPlayerRow[]> {
  const [players, sets] = await Promise.all([
    prisma.player.findMany({ select: { id: true, displayName: true, discordId: true } }),
    prisma.tourSet.findMany({ select: { playerAId: true, playerBId: true, seasonId: true } }),
  ]);
  const setCount = new Map<string, number>();
  const seasons = new Map<string, Set<string>>();
  for (const ts of sets) {
    for (const pid of [ts.playerAId, ts.playerBId]) {
      setCount.set(pid, (setCount.get(pid) ?? 0) + 1);
      if (ts.seasonId) {
        const s = seasons.get(pid) ?? new Set<string>();
        s.add(ts.seasonId);
        seasons.set(pid, s);
      }
    }
  }
  const needle = norm(q);
  let rows: TourPlayerRow[] = players.map((p) => ({
    id: p.id,
    name: p.displayName,
    discordId: p.discordId,
    linked: !p.discordId.startsWith("legacy:"),
    sets: setCount.get(p.id) ?? 0,
    seasons: seasons.get(p.id)?.size ?? 0,
  }));
  if (needle) rows = rows.filter((r) => norm(r.name).includes(needle));
  if (filter === "unlinked") rows = rows.filter((r) => !r.linked);
  else if (filter === "linked") rows = rows.filter((r) => r.linked);
  rows.sort((a, b) => b.sets - a.sets || a.name.localeCompare(b.name));
  const out = rows.slice(0, limit);

  // Auto-suggest a match for each UNLINKED player (one-click linking) from the
  // league list + signup-resolved Discord ids.
  const ref = await getSuggestRef();
  if (ref.length) {
    for (const r of out) if (!r.linked) r.suggestions = rankMatches(r.name, ref, 2);
  }
  return out;
}

// Set a Tour player's discordId to a real one. If that id already belongs to a
// DIFFERENT player, that's a duplicate → caller should merge instead.
export async function linkPlayer(playerId: string, discordId: string) {
  const id = discordId.trim();
  if (!id) throw new Error("A Discord id is required.");
  const conflict = await prisma.player.findUnique({ where: { discordId: id }, select: { id: true, displayName: true } });
  if (conflict && conflict.id !== playerId) {
    throw new Error(`That Discord id already belongs to "${conflict.displayName}" — merge the two players instead.`);
  }
  return prisma.player.update({ where: { id: playerId }, data: { discordId: id } });
}

// Merge `dropId` INTO `keepId`: repoint every player reference, then delete the
// duplicate. One transaction so a partial merge can't corrupt the history.
export async function mergePlayers(keepId: string, dropId: string) {
  if (keepId === dropId) throw new Error("Pick two different players.");
  const [keep, drop] = await Promise.all([
    prisma.player.findUnique({ where: { id: keepId }, select: { id: true, displayName: true } }),
    prisma.player.findUnique({ where: { id: dropId }, select: { id: true, displayName: true } }),
  ]);
  if (!keep || !drop) throw new Error("Player not found.");

  await prisma.$transaction(async (tx) => {
    // Core Match (stats derive from these).
    await tx.match.updateMany({ where: { playerAId: dropId }, data: { playerAId: keepId } });
    await tx.match.updateMany({ where: { playerBId: dropId }, data: { playerBId: keepId } });
    await tx.match.updateMany({ where: { winnerId: dropId }, data: { winnerId: keepId } });
    await tx.match.updateMany({ where: { reporterId: dropId }, data: { reporterId: keepId } });
    await tx.match.updateMany({ where: { disputedById: dropId }, data: { disputedById: keepId } });
    // Tour-side references.
    await tx.tourSet.updateMany({ where: { playerAId: dropId }, data: { playerAId: keepId } });
    await tx.tourSet.updateMany({ where: { playerBId: dropId }, data: { playerBId: keepId } });
    await tx.draftPick.updateMany({ where: { playerId: dropId }, data: { playerId: keepId } });
    await tx.award.updateMany({ where: { playerId: dropId }, data: { playerId: keepId } });
    await tx.teamSeason.updateMany({ where: { captainPlayerId: dropId }, data: { captainPlayerId: keepId } });
    // RosterEntry is unique per (roster, player): drop the dup's entry where keep is
    // already on that roster, repoint the rest.
    const keepRosters = new Set(
      (await tx.rosterEntry.findMany({ where: { playerId: keepId }, select: { rosterId: true } })).map((e) => e.rosterId),
    );
    for (const e of await tx.rosterEntry.findMany({ where: { playerId: dropId }, select: { id: true, rosterId: true } })) {
      if (keepRosters.has(e.rosterId)) await tx.rosterEntry.delete({ where: { id: e.id } });
      else await tx.rosterEntry.update({ where: { id: e.id }, data: { playerId: keepId } });
    }
    await tx.player.delete({ where: { id: dropId } });
  });

  return { keep: keep.displayName, dropped: drop.displayName };
}
