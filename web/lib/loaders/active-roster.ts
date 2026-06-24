import "server-only";

// Every ACTIVE player in the active season, as { id, label } where label is
// "Display Name · Division". Feeds the replace-a-player dropdown (and any other
// season-wide roster picker). Returns [] when there's no active season.

import { prisma } from "@/lib/prisma";

export async function loadActiveSeasonRoster(): Promise<{ id: string; label: string }[]> {
  const season = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!season) return [];
  const members = await prisma.divisionMember.findMany({
    where: { status: "ACTIVE", division: { seasonId: season.id } },
    select: {
      player: { select: { id: true, displayName: true } },
      division: { select: { name: true } },
    },
  });
  return members
    .map((m) => ({ id: m.player.id, label: `${m.player.displayName} · ${m.division.name}` }))
    .sort((a, b) => a.label.localeCompare(b.label));
}
