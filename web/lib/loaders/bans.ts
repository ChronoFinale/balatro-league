import "server-only";

import { prisma } from "@/lib/prisma";

export interface BannedPlayerRow {
  id: string;
  displayName: string;
  discordId: string;
  bannedAt: Date;
  bannedReason: string | null;
  bannedBy: string | null;
}

// Currently-banned players, most-recently banned first.
export async function loadBannedPlayers(): Promise<BannedPlayerRow[]> {
  const rows = await prisma.player.findMany({
    where: { bannedAt: { not: null } },
    select: { id: true, displayName: true, discordId: true, bannedAt: true, bannedReason: true, bannedBy: true },
    orderBy: { bannedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    displayName: r.displayName,
    discordId: r.discordId,
    bannedAt: r.bannedAt as Date,
    bannedReason: r.bannedReason,
    bannedBy: r.bannedBy,
  }));
}
