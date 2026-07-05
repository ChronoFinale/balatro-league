import "server-only";

// League ban helpers (web side). Mirrors src/bans.ts — a banned Player
// (Player.bannedAt set) can't sign up, be added to a round, opt into reminders,
// or be placed into a division.

import { prisma } from "@/lib/prisma";

export const BANNED_PLAYER_MESSAGE =
  "This player is banned from the league — unban them first (/admin/bans) if you want to include them.";
export const BANNED_SELF_MESSAGE =
  "You're banned from the league, so you can't sign up right now. If you think this is a mistake, reach out to a league moderator.";

export async function isDiscordIdBanned(discordId: string): Promise<boolean> {
  const p = await prisma.player.findUnique({ where: { discordId }, select: { bannedAt: true } });
  return p?.bannedAt != null;
}

export async function isPlayerIdBanned(playerId: string): Promise<boolean> {
  const p = await prisma.player.findUnique({ where: { id: playerId }, select: { bannedAt: true } });
  return p?.bannedAt != null;
}

// Banned subset of a list of Discord ids (for filtering signup audiences / builds).
export async function bannedDiscordIdSet(discordIds: string[]): Promise<Set<string>> {
  if (discordIds.length === 0) return new Set();
  const rows = await prisma.player.findMany({
    where: { discordId: { in: discordIds }, bannedAt: { not: null } },
    select: { discordId: true },
  });
  return new Set(rows.map((r) => r.discordId));
}

// Banned subset of a list of Player ids (for filtering placement inputs).
export async function bannedPlayerIdSet(playerIds: string[]): Promise<Set<string>> {
  if (playerIds.length === 0) return new Set();
  const rows = await prisma.player.findMany({
    where: { id: { in: playerIds }, bannedAt: { not: null } },
    select: { id: true },
  });
  return new Set(rows.map((r) => r.id));
}
