"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { crownChampion, uncrownChampion, addAward, removeAward } from "@/lib/services/season-end";
import type { ActionResult } from "@/lib/action-result";

function rev(season: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/end`);
  revalidatePath(`/admin/seasons/${enc}`);
}

export async function crownChampionAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    await crownChampion(season);
    rev(season);
    return { ok: true, message: "Champion crowned — season marked DONE." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not crown champion." };
  }
}

export async function uncrownChampionAction(formData: FormData) {
  if (!isAdmin()) return;
  const season = String(formData.get("season") ?? "");
  await uncrownChampion(season);
  rev(season);
}

export async function addAwardAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  const kind = String(formData.get("kind") ?? "");
  const playerId = String(formData.get("playerId") ?? "");
  const teamId = String(formData.get("teamId") ?? "");
  try {
    await addAward(season, kind, playerId, teamId);
    rev(season);
    return { ok: true, message: "Award added." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Could not add award." };
  }
}

export async function removeAwardAction(formData: FormData) {
  if (!isAdmin()) return;
  const season = String(formData.get("season") ?? "");
  const awardId = String(formData.get("awardId") ?? "");
  await removeAward(awardId);
  rev(season);
}
