// Season role reconciliation — the bot-side "hands" of apps/tour's role-sync brain
// (lib/services/discord-roles.ts, exposed via /api/bot/role-plan). Flow:
//   1. ask the web for the season's role ids (provisioning them here if missing),
//   2. snapshot who currently holds them in the guild,
//   3. ask the web for the add/remove plan against that snapshot,
//   4. apply it.
// Without the privileged GuildMembers intent we can't enumerate current holders, so we
// degrade to ADDS-ONLY (safe: never strips a role based on an incomplete snapshot).
import type { Guild } from "discord.js";
import { apiPost } from "./api";

interface RolePlanResponse {
  seasonName?: string;
  players: string[];
  captains: string[];
  playerRoleId: string | null;
  captainRoleId: string | null;
  unmappable: { playerId: string; name: string; role: string }[];
  plan: { players: { add: string[]; remove: string[] }; captains: { add: string[]; remove: string[] } };
  needsProvisioning: boolean;
}

export interface ReconcileResult {
  provisioned: string[];
  added: number;
  removed: number;
  skipped: number; // desired members not in the guild (or fetch failures)
  unmappable: number;
  addsOnly: boolean;
}

async function fetchAllMembers(guild: Guild): Promise<boolean> {
  try {
    await guild.members.fetch();
    return true;
  } catch {
    return false; // GuildMembers intent unavailable → adds-only mode
  }
}

function holdersOf(guild: Guild, roleId: string | null): string[] {
  if (!roleId) return [];
  const role = guild.roles.cache.get(roleId);
  return role ? [...role.members.keys()] : [];
}

export async function reconcileSeasonRoles(guild: Guild, seasonName: string): Promise<ReconcileResult> {
  // 1. Role ids (first pass — empty snapshot just to learn/provision the ids).
  let plan = await apiPost<RolePlanResponse>("/api/bot/role-plan", { season: seasonName, current: {} });
  const provisioned: string[] = [];
  let { playerRoleId, captainRoleId } = plan;
  if (!playerRoleId) {
    const role = await guild.roles.create({ name: `TT ${seasonName} Player`, mentionable: true, reason: "Team Tour season role" });
    playerRoleId = role.id;
    provisioned.push(`player=${role.id}`);
  }
  if (!captainRoleId) {
    const role = await guild.roles.create({ name: `TT ${seasonName} Captain`, mentionable: true, reason: "Team Tour season role" });
    captainRoleId = role.id;
    provisioned.push(`captain=${role.id}`);
  }
  if (provisioned.length) {
    await apiPost("/api/bot/role-ids", { season: seasonName, playerRoleId, captainRoleId });
  }

  // 2. Snapshot current holders (full member fetch needs the GuildMembers intent).
  const fullFetch = await fetchAllMembers(guild);
  const current = fullFetch
    ? { players: holdersOf(guild, playerRoleId), captains: holdersOf(guild, captainRoleId) }
    : { players: [], captains: [] };

  // 3. The authoritative plan against the real snapshot.
  plan = await apiPost<RolePlanResponse>("/api/bot/role-plan", { season: seasonName, current });

  // 4. Apply. Adds always; removes only with a trustworthy snapshot.
  let added = 0;
  let removed = 0;
  let skipped = 0;
  const apply = async (ids: string[], roleId: string, op: "add" | "remove") => {
    for (const discordId of ids) {
      try {
        const member = guild.members.cache.get(discordId) ?? (await guild.members.fetch(discordId));
        if (op === "add") {
          await member.roles.add(roleId);
          added++;
        } else {
          await member.roles.remove(roleId);
          removed++;
        }
      } catch {
        skipped++; // not in the guild (yet) or API hiccup — the next sync retries
      }
    }
  };
  await apply(plan.plan.players.add, playerRoleId, "add");
  await apply(plan.plan.captains.add, captainRoleId, "add");
  if (fullFetch) {
    await apply(plan.plan.players.remove, playerRoleId, "remove");
    await apply(plan.plan.captains.remove, captainRoleId, "remove");
  }

  return { provisioned, added, removed, skipped, unmappable: plan.unmappable.length, addsOnly: !fullFetch };
}
