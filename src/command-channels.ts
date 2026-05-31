// Channel-scope check for slash commands. Used by the InteractionCreate
// handler in src/index.ts to gate commands marked `channelScope: "match-flow"`
// to (a) the configured bot-commands channel, or (b) any per-division text
// channel managed by the bot.
//
// Division channels are looked up by Division.discordChannelId — set when
// the bot bootstraps a season's division channels. This lets us avoid an
// env-driven whitelist that admin would have to update every season.

import { prisma } from "./db.js";
import { env } from "./env.js";
import type { ChannelScope } from "./commands/types.js";

export interface ChannelCheckResult {
  allowed: boolean;
  // Markdown-ready reason to show the user when blocked. Includes a Discord
  // <#channelId> mention for the bot-commands channel when set so they can
  // click straight to it.
  reason?: string;
}

export async function checkChannelScope(
  scope: ChannelScope | undefined,
  channelId: string | null,
): Promise<ChannelCheckResult> {
  if (!scope || scope === "any") return { allowed: true };
  if (!channelId) return { allowed: false, reason: "This command must be used in a channel." };

  if (scope === "match-flow") {
    if (env.BOT_COMMANDS_CHANNEL_ID && channelId === env.BOT_COMMANDS_CHANNEL_ID) {
      return { allowed: true };
    }
    const div = await prisma.division.findFirst({
      where: { discordChannelId: channelId },
      select: { id: true },
    });
    if (div) return { allowed: true };
    const botCommandsMention = env.BOT_COMMANDS_CHANNEL_ID
      ? `<#${env.BOT_COMMANDS_CHANNEL_ID}>`
      : "a bot-commands channel (admin: set BOT_COMMANDS_CHANNEL_ID)";
    return {
      allowed: false,
      reason: `Run this in your division channel or ${botCommandsMention}.`,
    };
  }

  return { allowed: true };
}
