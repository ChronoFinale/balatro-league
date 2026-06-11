// Resolves the announcements channel id with admin-override precedence:
//   env.ANNOUNCEMENTS_CHANNEL_ID → LeagueConfig.AnnouncementsChannelId → null
//
// ensureAnnouncementsChannel runs once at bot startup and, if neither
// source has a value, creates a public #announcements channel in the
// '🃏 Balatro League' category and stores its id in LeagueConfig so it
// survives restarts.
//
// Used by:
//   - scheduled-start auto-activation (season goes live → post here)
//   - season-end recap (eventually)
//   - any future broadcast that's bigger than a single division

import { env } from "./env.js";
import { ensureGuildCategory, createGuildTextChannel } from "./discord-helpers.js";
import { getConfig, setConfig, LeagueConfigKey } from "./league-config.js";

export async function resolveAnnouncementsChannelId(): Promise<string | null> {
  if (env.ANNOUNCEMENTS_CHANNEL_ID) return env.ANNOUNCEMENTS_CHANNEL_ID;
  return getConfig(LeagueConfigKey.AnnouncementsChannelId);
}

export async function ensureAnnouncementsChannel(): Promise<void> {
  if (env.ANNOUNCEMENTS_CHANNEL_ID) {
    // Admin pinned a specific channel — respect that, don't auto-create.
    return;
  }
  const existing = await getConfig(LeagueConfigKey.AnnouncementsChannelId);
  if (existing) return;
  if (!env.DISCORD_GUILD_ID) {
    console.warn("[announcements] DISCORD_GUILD_ID not set; skipping auto-create");
    return;
  }
  const category = await ensureGuildCategory(env.DISCORD_GUILD_ID, "🃏 Balatro League");
  const channel = await createGuildTextChannel(env.DISCORD_GUILD_ID, "league-announcements", {
    parentId: category?.id,
    topic: "League-wide announcements: season starts, recaps, league news. Bot-posted, read-only for members.",
  });
  if (!channel) {
    console.warn(
      "[announcements] auto-create failed; admin can set ANNOUNCEMENTS_CHANNEL_ID env var or set the LeagueConfig key manually via /admin/config",
    );
    return;
  }
  await setConfig(LeagueConfigKey.AnnouncementsChannelId, channel.id, "bot-startup-auto-create");
  console.log(`[announcements] auto-created channel ${channel.id} and stored in LeagueConfig`);
}
