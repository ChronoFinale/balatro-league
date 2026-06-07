import { GuildMember, type User } from "discord.js";
import { prisma } from "./db.js";

// The player's CURRENT server (guild) display name from an interaction:
// nickname ?? global name ?? username. The invoking member rides along in
// every guild interaction payload, so this needs NO privileged GuildMembers
// intent. Returns undefined outside a guild / when unavailable.
export function guildDisplayName(interaction: { member: unknown }): string | undefined {
  const m = interaction.member;
  if (m instanceof GuildMember) return m.displayName || undefined;
  if (m && typeof m === "object" && "nick" in m) {
    const nick = (m as { nick?: string | null }).nick;
    return nick ?? undefined;
  }
  return undefined;
}

// Look up the Player row for a Discord user, creating one if it doesn't exist.
//
// Display name tracks their SERVER nickname: pass guildDisplayName(interaction)
// for the invoking user and we keep their name in sync with it. We NEVER:
//   - overwrite a name the player set themselves on the website
//     (hasCustomDisplayName), nor
//   - clobber the stored name with the global username when no server name is
//     supplied (e.g. for an opponent we only have a User). Leaving it alone
//     lets the daily refresh.display-names sync — which pulls every non-custom
//     player's guild nick — stay authoritative.
export async function getOrCreatePlayer(user: User, serverName?: string) {
  const existing = await prisma.player.findUnique({ where: { discordId: user.id } });
  if (existing) {
    const next = serverName?.trim();
    if (next && !existing.hasCustomDisplayName && next !== existing.displayName) {
      return prisma.player.update({ where: { discordId: user.id }, data: { displayName: next } });
    }
    return existing;
  }
  return prisma.player.create({
    data: { discordId: user.id, displayName: serverName?.trim() || user.username },
  });
}
