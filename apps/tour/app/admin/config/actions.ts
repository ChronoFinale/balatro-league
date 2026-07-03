"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { setConfig } from "@/lib/services/config";
import type { ActionResult } from "@/lib/action-result";

export async function setConfigAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  try {
    const key = String(formData.get("key") ?? "");
    await setConfig(key, String(formData.get("value") ?? ""));
    revalidatePath("/admin/config");
    return { ok: true, message: `Saved ${key}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Save failed." };
  }
}
