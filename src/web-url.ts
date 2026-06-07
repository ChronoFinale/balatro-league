// The web dashboard URL this bot instance links to. Centralised so the bot
// never hardcodes the prod domain — the test bot sets WEB_BASE_URL to its own
// web URL and every link it posts (division schedules, /league info, disputes,
// signups) automatically points at the test site instead of prod.

import { env } from "./env.js";

// Normalised base, no trailing slash. e.g. "https://www.balatroleague.com".
export const WEB_BASE = env.WEB_BASE_URL.replace(/\/+$/, "");

// Bare host (no protocol) for prose mentions. e.g. "www.balatroleague.com".
export const WEB_HOST = WEB_BASE.replace(/^https?:\/\//, "");

// Build a full URL for a path. webUrl() → base; webUrl("standings") →
// base + "/standings". Leading slashes on the path are tolerated.
export function webUrl(path = ""): string {
  if (!path) return WEB_BASE;
  return `${WEB_BASE}/${path.replace(/^\/+/, "")}`;
}
