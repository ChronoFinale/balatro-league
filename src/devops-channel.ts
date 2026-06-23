// Resolves the DevOps alert channel id. Mirrors backup-channel.ts:
//   env.DEVOPS_CHANNEL_ID → LeagueConfig.DevopsChannelId → null
//
// Null means "log to console only" — the alert cron still runs but
// won't post anywhere. That keeps the bot functional even if the
// admin never bootstraps a devops channel.

import { env } from "./env.js";
import { getConfig, LeagueConfigKey } from "./league-config.js";

export async function resolveDevopsChannelId(): Promise<string | null> {
  if (env.DEVOPS_CHANNEL_ID) return env.DEVOPS_CHANNEL_ID;
  return getConfig(LeagueConfigKey.DevopsChannelId);
}
