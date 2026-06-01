"use server";

// Server actions for /admin/settings (league rules template manager).
// All writes:
//   1. Validate the input (cross-field constraint: pool - bans >= 1)
//   2. Mutate the LeagueRulesTemplate row
//   3. Invalidate the in-process settings cache (so the next read picks
//      up the new values immediately on the web side; bot picks up
//      within ~30s via its own TTL)
//   4. Recompute standings IF the change could affect them (scoring
//      changes) — affected divisions only, scoped to seasons that
//      reference the template OR the default if no season specifies

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { actorFromAdminUser, recordAudit } from "@/lib/audit";
import { invalidateLeagueSettingsCache } from "@/lib/league-settings";
import { prisma } from "@/lib/prisma";
import { recomputeDivisionStandings } from "@/lib/standings-cache";

const NUMERIC_FIELDS = [
  ["pointsFor20Win", 0],
  ["pointsFor11Draw", 0],
  ["pointsForLoss", 0],
  ["firstPlayerBans", 1],
  ["secondPlayerBans", 0],
  ["matchPoolSize", 3],
  ["matchInviteExpiryMinutes", 1],
  ["reportAutoConfirmSeconds", 0],
] as const;

function parseFields(formData: FormData): { values: Record<string, number>; error: string | null } {
  const values: Record<string, number> = {};
  for (const [name, min] of NUMERIC_FIELDS) {
    const raw = formData.get(name);
    const n = parseInt(String(raw ?? ""), 10);
    if (!Number.isFinite(n) || n < min) {
      return { values, error: `${name} must be an integer >= ${min}` };
    }
    values[name] = n;
  }
  const remaining = values.matchPoolSize! - values.firstPlayerBans! - values.secondPlayerBans!;
  if (remaining < 1) {
    return { values, error: "Pool size must leave at least 1 combo after both players ban" };
  }
  return { values, error: null };
}

// Create a new template OR update an existing one (when `id` present).
// Caller form must include all numeric fields plus `name`.
export async function saveRulesTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/admin/settings?err=name-required");

  const { values, error } = parseFields(formData);
  if (error) redirect(`/admin/settings?err=${encodeURIComponent(error)}`);

  const data = { name, ...values };
  let resultId: string;
  if (id) {
    const updated = await prisma.leagueRulesTemplate.update({ where: { id }, data });
    resultId = updated.id;
  } else {
    const created = await prisma.leagueRulesTemplate.create({ data });
    resultId = created.id;
  }
  invalidateLeagueSettingsCache();
  recordAudit({
    actor: actorFromAdminUser(user),
    action: id ? "rules-template.update" : "rules-template.create",
    targetType: "LeagueRulesTemplate",
    targetId: resultId,
    summary: `${id ? "Updated" : "Created"} rules template "${name}"`,
    metadata: values,
  });

  // Scoring change can ripple into standings. Recompute every division
  // referencing this template — and if it's the default, also any
  // season that doesn't pick a specific template.
  const tpl = await prisma.leagueRulesTemplate.findUnique({ where: { id: resultId } });
  const affectedDivisions = await prisma.division.findMany({
    where: tpl?.isDefault
      ? {
          OR: [
            { season: { leagueRulesTemplateId: resultId } },
            { season: { leagueRulesTemplateId: null, isActive: true } },
          ],
        }
      : { season: { leagueRulesTemplateId: resultId } },
    select: { id: true },
  });
  for (const d of affectedDivisions) {
    await recomputeDivisionStandings(d.id).catch(() => {});
  }

  revalidatePath("/admin/settings");
  revalidatePath("/standings");
  redirect("/admin/settings?ok=1");
}

// Mark a template as the new default; clear isDefault on every other
// template in a single transaction so there's always exactly one.
export async function setDefaultRulesTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const tpl = await prisma.leagueRulesTemplate.findUnique({ where: { id } });
  if (!tpl) return;
  await prisma.$transaction([
    prisma.leagueRulesTemplate.updateMany({ where: { isDefault: true }, data: { isDefault: false } }),
    prisma.leagueRulesTemplate.update({ where: { id }, data: { isDefault: true } }),
  ]);
  invalidateLeagueSettingsCache();
  recordAudit({
    actor: actorFromAdminUser(user),
    action: "rules-template.set-default",
    targetType: "LeagueRulesTemplate",
    targetId: id,
    summary: `Set "${tpl.name}" as the default rules template`,
  });
  // Standings of seasons that fall through to the default will now
  // resolve differently. Recompute the active-season divisions that
  // don't pick a specific template.
  const fallthroughDivs = await prisma.division.findMany({
    where: { season: { leagueRulesTemplateId: null, isActive: true } },
    select: { id: true },
  });
  for (const d of fallthroughDivs) {
    await recomputeDivisionStandings(d.id).catch(() => {});
  }
  revalidatePath("/admin/settings");
  revalidatePath("/standings");
}

// Delete a template. Refuses if it's the default OR if any season
// references it (would force a silent rules change on those seasons).
export async function deleteRulesTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return;
  const tpl = await prisma.leagueRulesTemplate.findUnique({
    where: { id },
    include: { _count: { select: { seasons: true } } },
  });
  if (!tpl) return;
  if (tpl.isDefault) {
    redirect(`/admin/settings?err=${encodeURIComponent("Can't delete the default template — set another as default first.")}`);
  }
  if (tpl._count.seasons > 0) {
    redirect(`/admin/settings?err=${encodeURIComponent(`Template is used by ${tpl._count.seasons} season(s) — point them elsewhere first.`)}`);
  }
  await prisma.leagueRulesTemplate.delete({ where: { id } });
  invalidateLeagueSettingsCache();
  recordAudit({
    actor: actorFromAdminUser(user),
    action: "rules-template.delete",
    targetType: "LeagueRulesTemplate",
    targetId: id,
    summary: `Deleted rules template "${tpl.name}"`,
  });
  revalidatePath("/admin/settings");
}

// Per-season picker. Lives here rather than in /admin/seasons so the
// rules-template-related actions are all colocated.
export async function setSeasonRulesTemplate(formData: FormData) {
  const { user } = await requireAdmin();
  const seasonId = String(formData.get("seasonId") ?? "").trim();
  const templateIdRaw = String(formData.get("leagueRulesTemplateId") ?? "").trim();
  if (!seasonId) return;
  const leagueRulesTemplateId = templateIdRaw === "" ? null : templateIdRaw;
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { name: true } });
  await prisma.season.update({ where: { id: seasonId }, data: { leagueRulesTemplateId } });
  invalidateLeagueSettingsCache();
  if (season) {
    let templateName = "default";
    if (leagueRulesTemplateId) {
      const tpl = await prisma.leagueRulesTemplate.findUnique({ where: { id: leagueRulesTemplateId }, select: { name: true } });
      templateName = tpl?.name ?? leagueRulesTemplateId;
    }
    recordAudit({
      actor: actorFromAdminUser(user),
      action: "season.set-rules-template",
      targetType: "Season",
      targetId: seasonId,
      summary: `"${season.name}" rules template: ${templateName}`,
      metadata: { leagueRulesTemplateId },
    });
  }
  // Recompute this season's standings since scoring may have changed.
  const divisions = await prisma.division.findMany({
    where: { seasonId },
    select: { id: true },
  });
  for (const d of divisions) {
    await recomputeDivisionStandings(d.id).catch(() => {});
  }
  revalidatePath(`/admin/seasons/${seasonId}`);
  revalidatePath("/standings");
}
