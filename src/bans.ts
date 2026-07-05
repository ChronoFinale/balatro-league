// League ban helpers. A banned Player (Player.bannedAt set) can't sign up, be
// added to a round, opt into reminders, be placed, or start/queue any match.
// One home for the checks so every gate behaves identically.

import { prisma } from "./db.js";

// The player-facing message shown when a banned player tries to sign up or play.
export const BANNED_MESSAGE =
  "You're banned from the league, so you can't sign up or play right now. If you think this is a mistake, reach out to a league moderator.";

// Is the player with this Discord id banned? False if they have no Player row.
export async function isDiscordIdBanned(discordId: string): Promise<boolean> {
  const p = await prisma.player.findUnique({ where: { discordId }, select: { bannedAt: true } });
  return p?.bannedAt != null;
}

// Which of these Player ids are banned — gate a pair (or a list) in one query.
export async function bannedPlayerIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const rows = await prisma.player.findMany({
    where: { id: { in: ids }, bannedAt: { not: null } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}

// Which of these Discord ids are banned — for filtering the reminder audience.
export async function bannedDiscordIds(discordIds: string[]): Promise<Set<string>> {
  if (discordIds.length === 0) return new Set();
  const rows = await prisma.player.findMany({
    where: { discordId: { in: discordIds }, bannedAt: { not: null } },
    select: { discordId: true },
  });
  return new Set(rows.map((r) => r.discordId));
}
