"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { addSignup, setSignupStatus, removeSignup, type SignupStatus } from "@/lib/services/signups";
import type { ActionResult } from "@/lib/action-result";

function revalidate(season: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/signups`);
  revalidatePath(`/admin/seasons/${enc}`);
}

export async function addSignupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    const s = await addSignup(season, {
      discordId: String(formData.get("discordId") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      willingToCaptain: formData.get("willingToCaptain") === "on",
      bmpHandle: String(formData.get("bmpHandle") ?? ""),
    });
    revalidate(season);
    return { ok: true, message: `Added ${s.displayName ?? s.discordId} to the pool.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to add signup." };
  }
}

export async function setSignupStatusAction(formData: FormData) {
  if (!isAdmin()) return;
  await setSignupStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? "") as SignupStatus);
  revalidate(String(formData.get("season") ?? ""));
}

export async function removeSignupAction(formData: FormData) {
  if (!isAdmin()) return;
  await removeSignup(String(formData.get("id") ?? ""));
  revalidate(String(formData.get("season") ?? ""));
}
