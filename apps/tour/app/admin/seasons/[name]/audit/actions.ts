"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { buildMatchupsFromSets } from "@/lib/services/reconcile";
import type { ActionResult } from "@/lib/action-result";

// Rebuild Week/Matchup rows for an imported season from its flat TourSets, so the
// matchup-based tooling (audit, overlays, standings) works on it. TO-only.
export async function rebuildImportedMatchupsAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    const r = await buildMatchupsFromSets(season);
    revalidatePath(`/admin/seasons/${encodeURIComponent(season)}/audit`);
    revalidatePath(`/admin/seasons/${encodeURIComponent(season)}/schedule`);
    return { ok: true, message: `Rebuilt ${r.matchups} matchups across ${r.weeks} weeks from ${r.sets} imported sets (${r.flipped} re-oriented).` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Rebuild failed." };
  }
}
