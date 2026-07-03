"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { playerReportSet, playerConfirmSet, playerDisputeSet } from "@/lib/services/player-report";
import { renameTeam } from "@/lib/services/teams-admin";
import type { ActionResult } from "@/lib/action-result";

// The actor is always the signed-in viewer's playerId — the service verifies they're
// actually in the set, so a player can only report/confirm/dispute their own sets.
export async function reportSetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.playerId) return { ok: false, message: "Sign in to report." };
  // Optional per-game detail: rows game{N}Deck / game{N}Stake / game{N}Winner.
  const games: { deck: string; stake: string; winner: "me" | "opp" }[] = [];
  for (let i = 1; i <= 9; i++) {
    const deck = String(formData.get(`game${i}Deck`) ?? "");
    const stake = String(formData.get(`game${i}Stake`) ?? "");
    const winner = String(formData.get(`game${i}Winner`) ?? "");
    if (deck || stake || winner) games.push({ deck, stake, winner: winner === "opp" ? "opp" : "me" });
  }
  try {
    await playerReportSet(String(formData.get("setId") ?? ""), v.playerId, Number(formData.get("myGames")), Number(formData.get("oppGames")), games.length ? games : undefined);
    revalidatePath("/me");
    return { ok: true, message: games.length ? "Reported with game details — waiting on your opponent." : "Reported — waiting on your opponent to confirm." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Report failed." };
  }
}

// Captains (and co-captains) name their own team — can("ROSTERS", { teamSeasonId })
// is the gate, so TOs and ROSTERS mods pass too.
export async function renameMyTeamAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const teamSeasonId = String(formData.get("teamSeasonId") ?? "");
  if (!(await can("ROSTERS", { teamSeasonId }))) return { ok: false, message: "Only the team's captain can rename it." };
  try {
    const r = await renameTeam(teamSeasonId, String(formData.get("teamName") ?? ""));
    revalidatePath("/me");
    revalidatePath(`/teams/${teamSeasonId}`);
    return { ok: true, message: `Your team is now ${r.name}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Rename failed." };
  }
}

export async function confirmSetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.playerId) return { ok: false, message: "Sign in to confirm." };
  try {
    await playerConfirmSet(String(formData.get("setId") ?? ""), v.playerId);
    revalidatePath("/me");
    return { ok: true, message: "Confirmed — the result now counts." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Confirm failed." };
  }
}

export async function disputeSetAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const v = await getViewer();
  if (!v.playerId) return { ok: false, message: "Sign in to dispute." };
  try {
    await playerDisputeSet(String(formData.get("setId") ?? ""), v.playerId, String(formData.get("reason") ?? ""));
    revalidatePath("/me");
    return { ok: true, message: "Disputed — a TO will resolve it." };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Dispute failed." };
  }
}
