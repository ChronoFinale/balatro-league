"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { addSignup, setSignupStatus, setSignupStatusBulk, removeSignup, type SignupStatus } from "@/lib/services/signups";
import type { ActionResult } from "@/lib/action-result";

function revalidate(season: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/signups`);
  revalidatePath(`/admin/seasons/${enc}`);
}

export async function addSignupAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    // force: the committee can add a latecomer even after signups close.
    const s = await addSignup(season, {
      discordId: String(formData.get("discordId") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
      captainInterest: String(formData.get("captainInterest") ?? "") || undefined,
      bmpHandle: String(formData.get("bmpHandle") ?? ""),
    }, { force: true });
    revalidate(season);
    return { ok: true, message: `Added ${s.displayName ?? s.discordId} to the pool.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to add signup." };
  }
}

export async function setSignupStatusAction(formData: FormData) {
  if (!(await isAdmin())) return;
  await setSignupStatus(String(formData.get("id") ?? ""), String(formData.get("status") ?? "") as SignupStatus);
  revalidate(String(formData.get("season") ?? ""));
}

// Bulk approve/reject — the submit button's value carries the target status.
export async function bulkSignupStatusAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  const status = String(formData.get("bulkStatus") ?? "") as SignupStatus;
  if (status !== "APPROVED" && status !== "REJECTED") return { ok: false, message: "Pick approve or reject." };
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  if (!ids.length) return { ok: false, message: "Select at least one signup first." };
  const n = await setSignupStatusBulk(ids, status);
  revalidate(season);
  return { ok: true, message: `${n} signup${n === 1 ? "" : "s"} ${status === "APPROVED" ? "approved" : "rejected"}.` };
}

export async function removeSignupAction(formData: FormData) {
  if (!(await isAdmin())) return;
  await removeSignup(String(formData.get("id") ?? ""));
  revalidate(String(formData.get("season") ?? ""));
}
