"use server";

import { revalidatePath } from "next/cache";
import { isAdmin } from "@/lib/auth";
import { createTeamForSeason, renameTeam, setTeamConference, deleteTeamSeason } from "@/lib/services/teams-admin";
import type { ActionResult } from "@/lib/action-result";

function rev(season: string) {
  const enc = encodeURIComponent(season);
  revalidatePath(`/admin/seasons/${enc}/teams`);
  revalidatePath(`/admin/seasons/${enc}`);
  revalidatePath(`/seasons/${enc}`);
}

export async function createTeamAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    const r = await createTeamForSeason(season, {
      captainDiscordId: String(formData.get("captainDiscordId") ?? ""),
      name: String(formData.get("teamName") ?? "").trim() || undefined,
      conferenceId: String(formData.get("conferenceId") ?? "") || undefined,
    });
    rev(season);
    return { ok: true, message: `Created ${r.teamName} — captain ${r.captain}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Failed to create the team." };
  }
}

export async function renameTeamAdminAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  if (!(await isAdmin())) return { ok: false, message: "Not authorized." };
  const season = String(formData.get("season") ?? "");
  try {
    const r = await renameTeam(String(formData.get("teamSeasonId") ?? ""), String(formData.get("teamName") ?? ""));
    rev(season);
    return { ok: true, message: `Renamed to ${r.name}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Rename failed." };
  }
}

export async function setTeamConferenceAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const season = String(formData.get("season") ?? "");
  try {
    await setTeamConference(String(formData.get("teamSeasonId") ?? ""), String(formData.get("conferenceId") ?? ""));
  } catch {
    /* same-season guard — nothing sensible to show inline; the row keeps its old conference */
  }
  rev(season);
}

export async function deleteTeamAction(formData: FormData) {
  if (!(await isAdmin())) return;
  const season = String(formData.get("season") ?? "");
  try {
    await deleteTeamSeason(String(formData.get("teamSeasonId") ?? ""));
  } catch {
    /* already gone or bad id — the refreshed list shows reality */
  }
  rev(season);
}
