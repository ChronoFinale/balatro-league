// Resolves the announcements channel id with admin-override precedence:
//   env.ANNOUNCEMENTS_CHANNEL_ID → LeagueConfig.AnnouncementsChannelId → null
//
// Used by:
//   - scheduled-start auto-activation (season goes live → post here)
//   - season-end recap (eventually)
//   - any future broadcast that's bigger than a single division

import { env } from "./env.js";
import { getConfig, LeagueConfigKey } from "./league-config.js";

export async function resolveAnnouncementsChannelId(): Promise<string | null> {
  if (env.ANNOUNCEMENTS_CHANNEL_ID) return env.ANNOUNCEMENTS_CHANNEL_ID;
  return getConfig(LeagueConfigKey.AnnouncementsChannelId);
}
