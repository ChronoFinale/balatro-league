"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { enqueueActivityScan } from "@/lib/queue";

// Start an activity scan: create the ActivityScan row and enqueue the bot's
// activity.scan worker (which does the Discord message reads). No-op if one is
// already running.
export async function startActivityScan() {
  const { user } = await requireAdmin();
  const season = await prisma.season.findFirst({ where: { isActive: true }, select: { id: true } });
  if (!season) return;

  const running = await prisma.activityScan.findFirst({
    where: { status: "RUNNING", startedAt: { gt: new Date(Date.now() - 30 * 60 * 1000) } },
  });
  if (running) {
    revalidatePath("/admin/activity");
    return;
  }

  const scan = await prisma.activityScan.create({
    data: { seasonId: season.id, startedById: user.discordId },
  });
  await enqueueActivityScan(scan.id);
  revalidatePath("/admin/activity");
}
