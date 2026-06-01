"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { auth } from "@/auth";
import type { PermissionTier } from "@prisma/client";

// Upsert a LeagueConfig KV row. Empty string clears (parity with the
// 'clear' button — explicit empty input deletes the row).
export async function setConfigValue(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const value = String(formData.get("value") ?? "").trim();
  if (!key) return;
  const session = await auth();
  const updatedBy = (session?.user as { discordId?: string } | undefined)?.discordId ?? "admin";
  if (value === "") {
    await prisma.leagueConfig.deleteMany({ where: { key } });
  } else {
    await prisma.leagueConfig.upsert({
      where: { key },
      create: { key, value, updatedBy },
      update: { value, updatedBy },
    });
  }
  revalidatePath("/admin/config");
}

export async function clearConfigValue(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  if (!key) return;
  await prisma.leagueConfig.deleteMany({ where: { key } });
  revalidatePath("/admin/config");
}

// Add a new role → tier binding. Validates the discord role id shape
// (snowflake) and the tier enum. Unique constraint on discordRoleId
// means re-adding an existing role updates it via upsert.
export async function addRoleBinding(formData: FormData) {
  await requireAdmin();
  const discordRoleId = String(formData.get("discordRoleId") ?? "").trim();
  const tierRaw = String(formData.get("tier") ?? "").trim();
  if (!/^\d{17,20}$/.test(discordRoleId)) return;
  if (tierRaw !== "OWNER" && tierRaw !== "ADMIN" && tierRaw !== "MOD") return;
  const tier = tierRaw as PermissionTier;
  const session = await auth();
  const createdBy = (session?.user as { discordId?: string } | undefined)?.discordId ?? "admin";
  await prisma.roleBinding.upsert({
    where: { discordRoleId },
    create: { discordRoleId, tier, createdBy },
    update: { tier, createdBy },
  });
  revalidatePath("/admin/config");
}

export async function removeRoleBinding(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  await prisma.roleBinding.delete({ where: { id } });
  revalidatePath("/admin/config");
}
