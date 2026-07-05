"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { recordAudit, actorFromAdminUser } from "@/lib/audit";

// Ban a player from the league: blocks signing up, being added to a round,
// opting into reminders, being placed into a division, and starting/queuing any
// match. Reason is admin-only (stored + audited). Does NOT remove them from a
// live season — use the division DQ/void tools for that.
export async function banPlayerAction(formData: FormData) {
  const { user } = await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  if (!playerId) redirect(`/admin/bans?err=${encodeURIComponent("Pick a player to ban.")}`);
  if (!reason) redirect(`/admin/bans?err=${encodeURIComponent("A reason is required.")}`);

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    select: { displayName: true, bannedAt: true },
  });
  if (!player) redirect(`/admin/bans?err=${encodeURIComponent("Player not found.")}`);
  if (player!.bannedAt) redirect(`/admin/bans?err=${encodeURIComponent(`${player!.displayName} is already banned.`)}`);

  const actor = actorFromAdminUser(user);
  await prisma.player.update({
    where: { id: playerId },
    data: { bannedAt: new Date(), bannedReason: reason, bannedBy: actor.discordId },
  });
  await recordAudit({
    actor,
    action: "player.ban",
    targetType: "Player",
    targetId: playerId,
    summary: `Banned ${player!.displayName}`,
    metadata: { reason },
  });
  revalidatePath("/admin/bans");
  redirect(`/admin/bans?ok=${encodeURIComponent(`Banned ${player!.displayName}.`)}`);
}

export async function unbanPlayerAction(formData: FormData) {
  const { user } = await requireAdmin();
  const playerId = String(formData.get("playerId") ?? "").trim();
  if (!playerId) return;
  const player = await prisma.player.findUnique({ where: { id: playerId }, select: { displayName: true } });
  await prisma.player.update({
    where: { id: playerId },
    data: { bannedAt: null, bannedReason: null, bannedBy: null },
  });
  const actor = actorFromAdminUser(user);
  await recordAudit({
    actor,
    action: "player.unban",
    targetType: "Player",
    targetId: playerId,
    summary: `Unbanned ${player?.displayName ?? playerId}`,
  });
  revalidatePath("/admin/bans");
  redirect(`/admin/bans?ok=${encodeURIComponent(`Unbanned ${player?.displayName ?? "player"}.`)}`);
}
