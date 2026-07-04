// /ppt-admin bootstrap — provisions the tour's Discord layout on a fresh (test) server:
// one category, the tour's channels (with read-only vs postable permissions + topics), and the
// static staff roles (Tour Organizer -> TO tier, Helper -> HELPER tier). Mirrors the league
// bootstrap: a `dry-run` flag prints the plan without touching anything; apply creates/adopts
// idempotently and writes the ids back to the web (TourConfig + RoleBinding).
//
// The DESIRED layout is owned by the web (GET /api/bot/read?kind=bootstrap); this file only holds
// the gateway execution (resolve/create/edit) + the writeback (POST /api/bot/bootstrap-result).
// Resolver order per resource (never fuzzy): pinned id (still in guild) -> exact canonical name
// -> create. Per-season Player/Captain roles are NOT here — those stay with role-sync.
import {
  ChannelType,
  PermissionFlagsBits,
  type ChatInputCommandInteraction,
  type Guild,
  type TextChannel,
  type CategoryChannel,
  type PermissionOverwriteOptions,
} from "discord.js";
import { apiGet, apiPost } from "./../api";

interface ManifestChannel {
  name: string;
  topic: string;
  access: "readonly" | "postable";
  configKey?: string;
  currentId: string | null;
}
interface ManifestRole {
  tier: "TO" | "HELPER";
  name: string;
  currentId: string | null;
}
interface Manifest {
  category: string;
  channels: ManifestChannel[];
  roles: ManifestRole[];
}

const REASON = "Team Tour bootstrap";

// @everyone permission overwrite by access level; the bot always gets full posting rights.
function everyoneOpts(access: "readonly" | "postable"): PermissionOverwriteOptions {
  if (access === "readonly") {
    return { ViewChannel: true, ReadMessageHistory: true, AddReactions: true, SendMessages: false };
  }
  return {
    ViewChannel: true,
    ReadMessageHistory: true,
    SendMessages: true,
    EmbedLinks: true,
    AttachFiles: true,
    AddReactions: true,
    UseExternalEmojis: true,
    UseApplicationCommands: true,
  };
}
const BOT_OPTS: PermissionOverwriteOptions = {
  ViewChannel: true,
  SendMessages: true,
  EmbedLinks: true,
  AttachFiles: true,
  ManageMessages: true,
  AddReactions: true,
};

const asText = (ch: unknown): TextChannel | null =>
  ch && (ch as TextChannel).type === ChannelType.GuildText ? (ch as TextChannel) : null;

function findCategory(guild: Guild, name: string): CategoryChannel | null {
  const hit = guild.channels.cache.find((c) => c.type === ChannelType.GuildCategory && c.name === name);
  return (hit as CategoryChannel) ?? null;
}

// Resolve the manifest channel to an existing channel WITHOUT mutating: pinned id first, then
// exact canonical name. Returns the channel + what edits it needs (rename/move), or null to create.
function resolveChannel(guild: Guild, c: ManifestChannel, categoryName: string) {
  const pinned = c.currentId ? asText(guild.channels.cache.get(c.currentId)) : null;
  const byName = pinned ?? asText(guild.channels.cache.find((ch) => asText(ch)?.name === c.name));
  if (!byName) return null;
  const edits: string[] = [];
  if (byName.name !== c.name) edits.push(`rename #${byName.name} -> #${c.name}`);
  // Diff against the category NAME (not the possibly-not-yet-created id) so the dry-run flags a
  // move honestly even before the category exists. Topic drift mirrors the apply guard below.
  if (byName.parent?.name !== categoryName) edits.push("move into category");
  if (byName.topic !== c.topic) edits.push("update topic");
  return { channel: byName, edits };
}

async function applyChannelPerms(channel: TextChannel, access: "readonly" | "postable", botId: string) {
  await channel.permissionOverwrites.edit(channel.guild.roles.everyone.id, everyoneOpts(access), { reason: REASON });
  await channel.permissionOverwrites.edit(botId, BOT_OPTS, { reason: REASON });
}

export async function runBootstrap(interaction: ChatInputCommandInteraction): Promise<void> {
  const dryRun = interaction.options.getBoolean("dry-run") ?? false;
  await interaction.deferReply({ ephemeral: true });

  // Runtime re-check (belt-and-suspenders vs the command's ManageGuild default permission).
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({ content: "You need the Manage Server permission to run bootstrap." });
    return;
  }
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "Run this in the tour server." });
    return;
  }
  const botId = interaction.client.user.id;
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  const canManage =
    !!me && me.permissions.has(PermissionFlagsBits.ManageChannels) && me.permissions.has(PermissionFlagsBits.ManageRoles);

  const manifest = await apiGet<Manifest>("/api/bot/read?kind=bootstrap");
  // Warm the caches so resolution sees the real guild state.
  await guild.channels.fetch().catch(() => {});
  await guild.roles.fetch().catch(() => {});

  const applied = !dryRun && canManage; // did we actually mutate the guild this run?
  const plan: string[] = [];
  const reused: string[] = [];

  // ---- Category -----------------------------------------------------------
  let category = findCategory(guild, manifest.category);
  if (!category) plan.push(`+ create category ${manifest.category}`);
  else reused.push(`category ${manifest.category}`);

  if (applied && !category) {
    category = await guild.channels.create({ name: manifest.category, type: ChannelType.GuildCategory, reason: REASON });
  }
  const categoryId = category?.id ?? null;

  // ---- Channels -----------------------------------------------------------
  const persistChannels: { key: string; id: string }[] = [];
  for (const c of manifest.channels) {
    const resolved = resolveChannel(guild, c, manifest.category);
    if (!resolved) {
      plan.push(`+ create #${c.name} (${c.access})`);
      if (applied) {
        const created = await guild.channels.create({
          name: c.name,
          type: ChannelType.GuildText,
          parent: categoryId ?? undefined,
          topic: c.topic,
          reason: REASON,
        });
        await applyChannelPerms(created, c.access, botId);
        if (c.configKey) persistChannels.push({ key: c.configKey, id: created.id });
      }
      continue;
    }
    if (resolved.edits.length) plan.push(`~ #${c.name} (${resolved.edits.join(", ")})`);
    else reused.push(`#${c.name}`);
    // Pin an already-existing channel's id even when we can't mutate the guild — the writeback is
    // a web POST that needs no Discord permission (only real ids, never in dry-run).
    if (!dryRun && c.configKey) persistChannels.push({ key: c.configKey, id: resolved.channel.id });
    if (applied) {
      const ch = resolved.channel;
      if (resolved.edits.length) {
        await ch.edit({ name: c.name, parent: categoryId ?? undefined, topic: c.topic, reason: REASON });
      }
      await applyChannelPerms(ch, c.access, botId);
    }
  }

  // ---- Roles --------------------------------------------------------------
  // Binding a role to a tier is a PRIVILEGE GRANT, so bind only a role we already bound (pinned id)
  // or one we freshly create (empty by construction). A pre-existing same-NAMED role is NOT
  // auto-bound — that would silently hand its holders full tour admin; surface it for a manual
  // bind instead (mirrors the league bootstrap, which separates create-role from bind-to-tier).
  const persistRoles: { tier: "TO" | "HELPER"; discordRoleId: string }[] = [];
  for (const r of manifest.roles) {
    const pinnedRole = r.currentId ? guild.roles.cache.get(r.currentId) : undefined;
    if (pinnedRole) {
      reused.push(`@${pinnedRole.name} (${r.tier})`);
      if (!dryRun) persistRoles.push({ tier: r.tier, discordRoleId: pinnedRole.id });
      continue;
    }
    const nameMatch = guild.roles.cache.find((role) => role.name === r.name);
    if (nameMatch) {
      plan.push(`! @${r.name} exists but is NOT bound to ${r.tier} - bind it in /admin/access if that's intended`);
      continue;
    }
    plan.push(`+ create role @${r.name} -> ${r.tier}`);
    if (applied) {
      const role = await guild.roles.create({ name: r.name, mentionable: false, reason: REASON });
      persistRoles.push({ tier: r.tier, discordRoleId: role.id });
    }
  }

  // ---- Persist + report ---------------------------------------------------
  // Writeback whenever there are real ids to pin (created OR already-existing) — it's a web POST,
  // independent of the bot's Discord permissions. Never in dry-run.
  let wroteBack = false;
  if (!dryRun && (persistChannels.length || persistRoles.length)) {
    await apiPost("/api/bot/bootstrap-result", { channels: persistChannels, roles: persistRoles })
      .then(() => { wroteBack = true; })
      .catch((e) => {
        plan.push(`! writeback failed: ${e instanceof Error ? e.message : "error"} (re-run to re-pin)`);
      });
  }

  const header = dryRun
    ? "**Bootstrap dry-run** - nothing was changed."
    : canManage
      ? "**Bootstrap complete.**"
      : "**Bootstrap could not create anything** - I need the Manage Channels + Manage Roles permissions.";
  const lines = [header];
  if (plan.length) lines.push("", applied ? "__Changed:__" : "__Would change:__", ...plan);
  if (reused.length) lines.push("", `__Already in place (${reused.length}):__ ${reused.join(", ")}`);
  if (dryRun) lines.push("", "Re-run without `dry-run` to apply.");
  else if (wroteBack) lines.push("", "Channel ids pinned to config; freshly-created staff roles bound to their tiers.");

  await interaction.editReply({ content: lines.join("\n").slice(0, 1990) });
}
