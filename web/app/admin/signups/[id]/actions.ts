"use server";

import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { enqueueMmrSnapshot } from "@/lib/queue";

// Enqueue a fresh balatromp.com MMR fetch for every non-withdrawn signup in a
// round, so the pre-season MMR distribution can be populated/refreshed even
// while signups are still open. Ad-hoc capture (seasonId = the resulting season
// if one exists yet, else null — the round isn't a Season until build).
export async function refreshSignupMmrs(formData: FormData) {
  await requireAdmin();
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) redirect("/admin/seasons");
  const round = await prisma.signupRound.findUnique({
    where: { id: roundId },
    include: { signups: { where: { withdrawn: false }, select: { discordId: true } } },
  });
  if (!round) redirect("/admin/seasons");
  for (const s of round!.signups) {
    await enqueueMmrSnapshot({ discordId: s.discordId, seasonId: round!.resultingSeasonId ?? null }).catch(() => {});
  }
  redirect(`/admin/signups/${roundId}?refreshing=${round!.signups.length}`);
}
