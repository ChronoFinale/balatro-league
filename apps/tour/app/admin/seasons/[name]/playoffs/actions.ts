"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { startPlayoffs, reportSeries, resetPlayoffs } from "@/lib/services/playoffs";
import type { ActionResult } from "@/lib/action-result";

function rev(season: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/playoffs`);
  revalidatePath(`/admin/seasons/${enc}`);
}

export async function startPlayoffsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    const r = await startPlayoffs(season);
    rev(season);
    return { ok: true, message: `Playoffs started: ${r.field}-team field, ${r.round.toLowerCase()}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not start playoffs." };
  }
}

export async function reportSeriesAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  const seriesId = String(formData.get("seriesId") ?? "");
  const a = Number(formData.get("scoreA"));
  const b = Number(formData.get("scoreB"));
  try {
    await reportSeries(seriesId, a, b);
    rev(season);
    return { ok: true, message: "Series result recorded." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Report failed." };
  }
}

export async function resetPlayoffsAction(formData: FormData) {
  if (!isAdmin()) return;
  const season = String(formData.get("season") ?? "");
  await resetPlayoffs(season);
  rev(season);
}
