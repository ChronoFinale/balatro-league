// Resolves the bot-commands channel id(s) with admin-override precedence:
//   env.BOT_COMMANDS_CHANNEL_ID → LeagueConfig.BotCommandsChannelId → null

import { env } from "./env.js";
import { getConfig, LeagueConfigKey } from "./league-config.js";

// The bot-commands channel value may be a comma- (or whitespace-) separated
// LIST of channel ids — admins can allow public player commands in several
// channels. We extract every Discord snowflake (17-20 digit run) from the raw
// value, which makes this tolerant of how admins actually paste ids:
//   "123, 456"        → ["123","456"]
//   "<#123> <#456>"   → ["123","456"]   (channel MENTIONS copied from Discord)
//   "#name, 456"      → ["456"]          (a channel NAME has no snowflake, dropped)
// Without this, a single pasted <#…> mention or stray '#' made the whole list
// fail to match interaction.channelId, so commands worked in NO channel.
function parseIdList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return raw.match(/\d{17,20}/g) ?? [];
}

// Single id — the FIRST configured bot-commands channel. Used by callers that
// need one channel to POST to (e.g. report embeds when not in a division
// channel). Tolerates a CSV value by taking the first entry.
export async function resolveBotCommandsChannelId(): Promise<string | null> {
  const raw = env.BOT_COMMANDS_CHANNEL_ID || (await getConfig(LeagueConfigKey.BotCommandsChannelId));
  return parseIdList(raw)[0] ?? null;
}

// Full allow-list of channels where public ("not ephemeral") player commands
// may run: every configured bot-commands channel (CSV) PLUS the admin channel
// so staff can run them in admin chat. Membership-checked by the scope gate.
//
// The env var and the LeagueConfig value are MERGED (not env-overrides-config):
// admins manage the multi-channel list in /admin/config, and a leftover single
// BOT_COMMANDS_CHANNEL_ID env var (e.g. a stale one from a previous server) must
// not silently suppress that list. Both are parsed as CSV; ids are de-duped.
export async function resolveBotCommandsChannelIds(): Promise<string[]> {
  const fromEnv = parseIdList(env.BOT_COMMANDS_CHANNEL_ID);
  const fromConfig = parseIdList(await getConfig(LeagueConfigKey.BotCommandsChannelId));
  const admin = parseIdList(await getConfig(LeagueConfigKey.AdminChannelId));
  return Array.from(new Set([...fromEnv, ...fromConfig, ...admin]));
}
