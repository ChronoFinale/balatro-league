"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { enqueueRoleReconcile } from "@/lib/queue";
import type { ActionResult } from "@/lib/action-result";

// Queue a role reconciliation for the season. The tour bot picks the job up and applies
// the add/remove plan in the guild (provisioning the roles first if needed).
export async function syncRolesNowAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  if (!season) return { ok: false, message: "No season." };
  await enqueueRoleReconcile(season);
  revalidatePath(`/admin/seasons/${encodeURIComponent(season)}/discord`);
  return { ok: true, message: "Sync queued — the bot will apply it within a few seconds (it must be online)." };
}
