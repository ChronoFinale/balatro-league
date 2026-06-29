// Live read of the LEAGUE database — READ-ONLY, optional. When LEAGUE_DATABASE_URL
// is set (a `tour_ro` SELECT-only role), the Tour reads the league's `Player` table
// directly so identity-linking uses always-current Discord ids (no CSV export). If
// it's unset or the read fails, callers fall back to the uploaded LeagueRef / CSV.
//
// Uses a small `pg` pool (the Tour's Prisma client is for the Tour schema, so a raw
// connection is the clean way to read a DIFFERENT app's table). Results cached briefly.
import { Pool } from "pg";

export interface LeaguePlayer {
  discordId: string;
  name: string;
}

let pool: Pool | null = null;
function leaguePool(): Pool | null {
  if (!process.env.LEAGUE_DATABASE_URL) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.LEAGUE_DATABASE_URL,
      max: 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 8_000,
      // Railway public proxy serves TLS; don't fail on the self-signed chain.
      ssl: { rejectUnauthorized: false },
    });
  }
  return pool;
}

export const leagueDbConfigured = () => !!process.env.LEAGUE_DATABASE_URL;

let cache: { at: number; rows: LeaguePlayer[] } | null = null;
const TTL_MS = 5 * 60 * 1000;

// The league's players as name→discordId rows — one for the display name and one
// for the Discord @username (so callers can match on either). Null when not
// configured; throws on a real connection/query error so the caller can fall back.
export async function leaguePlayersLive(): Promise<LeaguePlayer[] | null> {
  const p = leaguePool();
  if (!p) return null;
  const now = Date.now();
  if (cache && now - cache.at < TTL_MS) return cache.rows;
  const res = await p.query<{ discordId: string; displayName: string; username: string | null }>(
    'SELECT "discordId", "displayName", "username" FROM "Player" WHERE "discordId" IS NOT NULL',
  );
  const rows: LeaguePlayer[] = [];
  for (const r of res.rows) {
    const discordId = String(r.discordId);
    if (!/^\d+$/.test(discordId)) continue;
    if (r.displayName) rows.push({ discordId, name: String(r.displayName) });
    if (r.username) rows.push({ discordId, name: String(r.username) });
  }
  cache = { at: now, rows };
  return rows;
}

// Cheap connectivity check for diagnostics (true/false; never throws).
export async function leagueDbReachable(): Promise<boolean> {
  const p = leaguePool();
  if (!p) return false;
  try {
    await p.query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}
