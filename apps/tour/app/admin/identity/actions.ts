"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { linkPlayer, mergePlayers } from "@/lib/services/identity";
import type { ActionResult } from "@/lib/action-result";

export async function linkPlayerAction(playerId: string, discordId: string): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  try {
    await linkPlayer(playerId, discordId);
    revalidatePath("/admin/identity");
    return { ok: true, message: "Linked." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Link failed." };
  }
}

export async function mergePlayerAction(keepId: string, dropId: string): Promise<ActionResult> {
  if (!isAdmin()) return { ok: false, message: "Not authorized." };
  try {
    const r = await mergePlayers(keepId, dropId);
    revalidatePath("/admin/identity");
    return { ok: true, message: `Merged ${r.dropped} into ${r.keep}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Merge failed." };
  }
}
