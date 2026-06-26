"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { makePair, overridePair, setSendFirst, removePair, resetPairing } from "@/lib/services/pairing";
import type { ActionResult } from "@/lib/action-result";

function rev(matchupId: string) {
  revalidatePath(`/admin/matchups/${matchupId}`);
}

export async function makePairAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const matchupId = String(formData.get("matchupId") ?? "");
  const proposer = String(formData.get("proposerPlayerId") ?? "");
  const responder = String(formData.get("responderPlayerId") ?? "");
  try {
    const r = await makePair(matchupId, proposer, responder);
    rev(matchupId);
    return { ok: true, message: `Pair ${r.pairs} set.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Pairing failed." };
  }
}

export async function overridePairAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const matchupId = String(formData.get("matchupId") ?? "");
  const a = String(formData.get("aPlayerId") ?? "");
  const b = String(formData.get("bPlayerId") ?? "");
  try {
    await overridePair(matchupId, a, b);
    rev(matchupId);
    return { ok: true, message: "Override pair set." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Override failed." };
  }
}

export async function setSendFirstAction(formData: FormData) {
  if (!isAdmin()) return;
  const matchupId = String(formData.get("matchupId") ?? "");
  const team = formData.get("team") === "B" ? "B" : "A";
  await setSendFirst(matchupId, team);
  rev(matchupId);
}

export async function removePairAction(formData: FormData) {
  if (!isAdmin()) return;
  const matchupId = String(formData.get("matchupId") ?? "");
  const setId = String(formData.get("setId") ?? "");
  await removePair(setId);
  rev(matchupId);
}

export async function resetPairingAction(formData: FormData) {
  if (!isAdmin()) return;
  const matchupId = String(formData.get("matchupId") ?? "");
  await resetPairing(matchupId);
  rev(matchupId);
}
