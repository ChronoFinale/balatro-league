// Server bootstrap — the DESIRED Discord guild layout (one category, the tour's channels,
// the static staff roles) for a fresh test server. The web owns this manifest as the single
// source of truth; the bot (which holds the gateway) fetches it via /api/bot/read?kind=bootstrap,
// resolves/creates the resources idempotently, and writes the created ids back through
// applyBootstrapResult (POST /api/bot/bootstrap-result). Per-season Player/Captain roles are NOT
// here — those stay with the existing role-sync. This mirrors the league bootstrap, but a single
// manifest drives BOTH the dry-run diff and the apply (league kept two hand-synced lists).
import { getConfig, setConfig } from "./config";
import { prisma } from "../db";

// Access presets the bot maps to permission overwrites:
//   readonly  — members read/react, only the bot posts (announcements/results/draft/schedule/standings)
//   postable  — members can post (general/pickem/casting/bot-commands)
export type ChannelAccess = "readonly" | "postable";

export interface ManifestChannel {
  name: string; // canonical Discord channel name (lowercase-hyphen; Discord normalizes anyway)
  topic: string;
  access: ChannelAccess;
  configKey?: string; // set => the bot pins the created/adopted id into TourConfig under this key
}

export interface ManifestRole {
  tier: "TO" | "HELPER";
  name: string;
}

// Emoji via \u escape so the source file stays pure ASCII (repo gotcha: literal Unicode has
// injected NUL bytes here). Discord renders it fine at runtime.
export const BOOTSTRAP_CATEGORY = "\u{1F355} Team Tour";

export const BOOTSTRAP_CHANNELS: ManifestChannel[] = [
  { name: "tt-announcements", topic: "Season milestones and TO posts.", access: "readonly", configKey: "channel.announcements" },
  { name: "tt-results", topic: "Match and set results, posted by the bot.", access: "readonly", configKey: "channel.results" },
  { name: "tt-draft", topic: "Live draft picks and on-the-clock pings.", access: "readonly", configKey: "channel.draft" },
  { name: "tt-schedule", topic: "Weekly matchups and post times.", access: "readonly", configKey: "channel.schedule" },
  { name: "tt-standings", topic: "Conference standings snapshots.", access: "readonly", configKey: "channel.standings" },
  { name: "tt-general", topic: "Team Tour chat.", access: "postable" },
  { name: "tt-pickem", topic: "Pick'em talk and predictions.", access: "postable" },
  { name: "tt-casting", topic: "Casting and stream coordination.", access: "postable" },
  { name: "tt-bot-commands", topic: "Run /ppt commands here.", access: "postable" },
];

export const BOOTSTRAP_ROLES: ManifestRole[] = [
  { tier: "TO", name: "Tour Organizer" },
  { tier: "HELPER", name: "Helper" },
];

export interface BootstrapManifest {
  category: string;
  channels: (ManifestChannel & { currentId: string | null })[];
  roles: (ManifestRole & { currentId: string | null })[];
}

// The manifest enriched with what's already recorded, so the bot's resolver can prefer a pinned
// id ("stored-id wins") before falling back to name-match / create. Channel ids come from
// TourConfig; static role ids come from RoleBinding (first role bound to that tier).
export async function getBootstrapManifest(): Promise<BootstrapManifest> {
  const channels = await Promise.all(
    BOOTSTRAP_CHANNELS.map(async (c) => ({ ...c, currentId: c.configKey ? await getConfig(c.configKey) : null })),
  );
  const bindings = await prisma.roleBinding.findMany({ where: { tier: { in: ["TO", "HELPER"] } }, orderBy: { createdAt: "asc" } });
  const firstOfTier = new Map<string, string>();
  for (const b of bindings) if (!firstOfTier.has(b.tier)) firstOfTier.set(b.tier, b.discordRoleId);
  const roles = BOOTSTRAP_ROLES.map((r) => ({ ...r, currentId: firstOfTier.get(r.tier) ?? null }));
  return { category: BOOTSTRAP_CATEGORY, channels, roles };
}

// Persist what the bot just provisioned: pin channel ids into TourConfig and bind static role
// ids to their tier. Idempotent — re-running with the same ids is a no-op upsert. Only keys we
// declare are accepted, and only TO/HELPER tiers, so a bad payload can't rewrite arbitrary config.
export async function applyBootstrapResult(input: {
  channels?: { key: string; id: string }[];
  roles?: { tier: "TO" | "HELPER"; discordRoleId: string }[];
}): Promise<{ channels: number; roles: number }> {
  const allowedKeys = new Set(BOOTSTRAP_CHANNELS.map((c) => c.configKey).filter((k): k is string => !!k));
  let channels = 0;
  for (const c of input.channels ?? []) {
    if (!allowedKeys.has(c.key) || !c.id.trim()) continue;
    await setConfig(c.key, c.id.trim());
    channels++;
  }
  let roles = 0;
  for (const r of input.roles ?? []) {
    if ((r.tier !== "TO" && r.tier !== "HELPER") || !r.discordRoleId.trim()) continue;
    const discordRoleId = r.discordRoleId.trim();
    await prisma.roleBinding.upsert({
      where: { discordRoleId },
      create: { discordRoleId, tier: r.tier, createdBy: "bootstrap" },
      update: { tier: r.tier },
    });
    roles++;
  }
  return { channels, roles };
}
