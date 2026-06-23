// Resolves the casual-challenge parent channel id with admin-override
// precedence:
//   LeagueConfig.ChallengesChannelId → null (fall back to interaction's
//                                      channel = bot-commands typically)

import { getConfig, LeagueConfigKey } from "./league-config.js";

export async function resolveChallengesChannelId(): Promise<string | null> {
  return getConfig(LeagueConfigKey.ChallengesChannelId);
}
