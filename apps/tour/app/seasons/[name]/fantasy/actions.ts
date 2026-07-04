"use server";

// Manager-facing fantasy actions. Identity ALWAYS comes from getViewer() (the signed-in
// Discord user) - never from FormData - so a manager can only act as themselves. Join is a
// standalone form (inline banner); picks are a grid of buttons (toast, per the many-actions
// convention). The service enforces turn order, ownership, and unique picks.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { joinFantasyLeague, makeFantasyPick } from "@/lib/services/fantasy";
import type { ActionResult } from "@/lib/action-result";

export async function joinFantasyAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.discordId) return { ok: false, message: "Sign in with Discord to join." };
  const season = String(formData.get("season") ?? "");
  try {
    const name = String(formData.get("managerName") ?? "").trim() || v.name || v.discordId;
    const r = await joinFantasyLeague(season, { discordId: v.discordId, name });
    revalidatePath(`/seasons/${encodeURIComponent(season)}/fantasy`);
    return { ok: true, message: `You're in as manager ${r.managerCount} of up to ${r.cap}. The draft starts when the TO opens it.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Couldn't join the league." };
  }
}

export async function makePickAction(formData: FormData) {
  const season = String(formData.get("season") ?? "");
  const enc = encodeURIComponent(season);
  const v = await getViewer();
  let ok = true;
  let msg = "Picked.";
  if (!v.discordId) {
    ok = false;
    msg = "Sign in with Discord to draft.";
  } else {
    try {
      const r = await makeFantasyPick(season, v.discordId, String(formData.get("playerId") ?? ""));
      msg = r.done ? "That's a wrap - the fantasy draft is complete!" : "Picked.";
    } catch (e) {
      ok = false;
      msg = e instanceof Error ? e.message : "Couldn't make that pick.";
    }
  }
  revalidatePath(`/seasons/${enc}/fantasy/draft`);
  revalidatePath(`/seasons/${enc}/fantasy`);
  const qs = new URLSearchParams();
  qs.set(ok ? "ok" : "err", msg);
  redirect(`/seasons/${enc}/fantasy/draft?${qs.toString()}`);
}
