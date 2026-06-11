// Resolves the bot-commands channel id with admin-override precedence:
//   env.BOT_COMMANDS_CHANNEL_ID → LeagueConfig.BotCommandsChannelId → null
//
// ensureBotCommandsChannel runs once at bot startup and, if neither
// source has a value, creates a public #bot-commands channel in the
// guild and stores its id in LeagueConfig so it survives restarts.
// Admin can override later by setting the env var (which always wins).

import { env } from "./env.js";
import { resolveConfiguredCategory, createGuildTextChannel } from "./discord-helpers.js";
import { getConfig, setConfig, LeagueConfigKey } from "./league-config.js";

export async function resolveBotCommandsChannelId(): Promise<string | null> {
  if (env.BOT_COMMANDS_CHANNEL_ID) return env.BOT_COMMANDS_CHANNEL_ID;
  return getConfig(LeagueConfigKey.BotCommandsChannelId);
}

export async function ensureBotCommandsChannel(): Promise<void> {
  if (env.BOT_COMMANDS_CHANNEL_ID) {
    // Admin pinned a specific channel — respect that, don't auto-create.
    return;
  }
  const existing = await getConfig(LeagueConfigKey.BotCommandsChannelId);
  if (existing) return;
  if (!env.DISCORD_GUILD_ID) {
    console.warn("[bot-commands] DISCORD_GUILD_ID not set; skipping auto-create");
    return;
  }
  // Nest under the same '🃏 Balatro League' style category as everything
  // else for tidiness. Fall back to top-level if category creation fails.
  const category = await resolveConfiguredCategory(env.DISCORD_GUILD_ID, LeagueConfigKey.LeagueCategoryId, "🃏 Balatro League");
  const channel = await createGuildTextChannel(env.DISCORD_GUILD_ID, "league-bot-commands", {
    parentId: category?.id,
    topic: "Use match flow commands here when you're not in a division channel.",
  });
  if (!channel) {
    console.warn("[bot-commands] auto-create failed; admin can set BOT_COMMANDS_CHANNEL_ID env var or run /league set-bot-commands-channel manually");
    return;
  }
  await setConfig(LeagueConfigKey.BotCommandsChannelId, channel.id, "bot-startup-auto-create");
  console.log(`[bot-commands] auto-created channel ${channel.id} and stored in LeagueConfig`);
}
