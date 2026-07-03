// Environment contract for the Tour bot. Required vars fail fast at boot with a clear
// message (mirrors the league bot's src/env.ts approach).
import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`[env] Missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

export const env = {
  /** The Tour bot's own Discord token (dedicated application — NOT the league bot's). */
  DISCORD_TOKEN: required("DISCORD_TOKEN"),
  /** The Pizza Power guild (or a TEST guild for dry runs). Bot refuses others. */
  TOUR_GUILD_ID: required("TOUR_GUILD_ID"),
  /** Tour Postgres — used ONLY for pg-boss (the bot holds no domain data). */
  DATABASE_URL: required("DATABASE_URL"),
  /** The tour web app the bot calls for all reads/writes (e.g. https://tour.balatroleague.com). */
  TOUR_WEB_URL: required("TOUR_WEB_URL").replace(/\/$/, ""),
  /** Bearer token for /api/bot/* + /api/admin/* routes (isApiAdmin). */
  TOUR_ADMIN_TOKEN: required("TOUR_ADMIN_TOKEN"),
};
