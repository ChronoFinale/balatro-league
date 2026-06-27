"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { assertAdmin, isAdmin } from "@/lib/auth";
import { createSeason, updateSeason } from "@/lib/services/seasons";
import { importHistorical, importTT10 } from "@/lib/services/import";
import type { ActionResult } from "@/lib/action-result";

// Server actions = thin form wrappers over the same services the API route calls.
export async function createSeasonAction(formData: FormData) {
  await assertAdmin();
  await createSeason({
    name: String(formData.get("name") ?? ""),
    format: String(formData.get("format") ?? "SWISS") as "SWISS" | "CONFERENCES",
    teamSize: Number(formData.get("teamSize") ?? 11),
    setsToWin: Number(formData.get("setsToWin") ?? 0) || undefined,
    conferenceCount: Number(formData.get("conferenceCount") ?? 2),
    playoffTeams: Number(formData.get("playoffTeams") ?? 8),
  });
  revalidatePath("/admin");
  revalidatePath("/");
  redirect("/admin");
}

// ActionResult-returning so they drive <ActionFlashForm> (pending + result flash).
export async function importHistoricalAction(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  try {
    const r = await importHistorical();
    revalidatePath("/admin");
    revalidatePath("/");
    return {
      ok: true,
      message: `Imported all-time: ${r.players} players, ${r.teams} teams, ${r.tourSets} sets, ${r.playoffSeries} playoff series.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Import failed." };
  }
}

export async function importTT10Action(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  try {
    const r = await importTT10();
    revalidatePath("/admin");
    revalidatePath("/");
    return {
      ok: true,
      message: `Imported TT10: ${r.conferences} conferences, ${r.teams} teams, ${r.matchups} matchups.`,
    };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Import failed." };
  }
}

export async function updateSeasonStateAction(formData: FormData) {
  await assertAdmin();
  const name = String(formData.get("name") ?? "");
  const state = String(formData.get("state") ?? "") as
    | "SIGNUPS"
    | "DRAFTING"
    | "REGULAR"
    | "PLAYOFFS"
    | "DONE";
  await updateSeason(name, { state });
  revalidatePath("/admin");
  revalidatePath(`/admin/seasons/${encodeURIComponent(name)}`);
  revalidatePath(`/seasons/${encodeURIComponent(name)}`);
}
