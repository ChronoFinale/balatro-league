"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { createRanking, updateRanking, deleteRanking, addRankingEntry, removeRankingEntry } from "@/lib/services/rankings";
import type { ActionResult } from "@/lib/action-result";

function rev(season: string, id?: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/rankings`);
  if (id) revalidatePath(`/admin/seasons/${enc}/rankings/${id}`);
  revalidatePath(`/seasons/${enc}/rankings`);
  revalidatePath(`/seasons/${enc}`);
}
const wk = (fd: FormData) => { const v = fd.get("week"); const n = Number(v); return v != null && String(v).trim() !== "" && Number.isFinite(n) && n > 0 ? n : null; };

export async function createRankingAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const season = String(formData.get("season") ?? "");
  const r = await createRanking(season, {
    kind: String(formData.get("kind") ?? "TEAM") === "PLAYER" ? "PLAYER" : "TEAM",
    week: wk(formData),
    title: String(formData.get("title") ?? ""),
    author: String(formData.get("author") ?? "") || null,
    authorPlayerId: String(formData.get("authorPlayerId") ?? "") || null,
  });
  rev(season, r.id);
  redirect(`/admin/seasons/${encodeURIComponent(season)}/rankings/${r.id}`);
}

export async function deleteRankingAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const season = String(formData.get("season") ?? "");
  await deleteRanking(String(formData.get("id") ?? ""));
  rev(season);
}

export async function updateRankingAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  const id = String(formData.get("id") ?? "");
  try {
    await updateRanking(id, { week: wk(formData), title: String(formData.get("title") ?? ""), author: String(formData.get("author") ?? "") || null, authorPlayerId: String(formData.get("authorPlayerId") ?? "") || null });
    rev(season, id);
    return { ok: true, message: "Saved." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed." };
  }
}

export async function addEntryAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  const id = String(formData.get("rankingId") ?? "");
  try {
    const pos = Number(formData.get("position"));
    await addRankingEntry(id, { targetId: String(formData.get("targetId") ?? ""), tier: String(formData.get("tier") ?? "") || null, note: String(formData.get("note") ?? "") || null, position: Number.isFinite(pos) && pos > 0 ? pos : undefined });
    rev(season, id);
    return { ok: true, message: "Added." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed." };
  }
}

export async function removeEntryAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const season = String(formData.get("season") ?? "");
  await removeRankingEntry(String(formData.get("entryId") ?? ""));
  rev(season, String(formData.get("rankingId") ?? ""));
}
