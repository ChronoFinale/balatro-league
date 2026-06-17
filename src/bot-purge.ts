// Scan everyone who's entered the league (signups + built players) against
// Discord's authoritative `bot` flag and remove any bot account entirely.
//
// A bot account isn't a player. The signup button now rejects them, but this
// is the cleanup for any that got in before that guard — and a standing
// verification tool (it reports "0 bots" when there's nothing to do).
//
// `user.bot` comes straight from Discord, so there are no false positives: a
// real human account is never flagged. That's why removal is unconditional —
// no preview/confirm step needed.

import type { Client } from "discord.js";
import { prisma } from "./db.js";
import { isDiscordSnowflake } from "./discord-helpers.js";
import { recordAudit, type AuditActor } from "./audit.js";

export interface BotRemoval {
  discordId: string;
  username: string;
  removedSignups: number;
  deletedPlayer: boolean;
  deletedMatches: number;
}

export interface BotPurgeResult {
  scanned: number; // distinct real-snowflake ids checked against Discord
  unresolved: number; // ids Discord couldn't resolve (deleted account?) — left untouched
  removed: BotRemoval[];
}

// Remove ONE confirmed-bot discordId from the league. Signup rows have no
// children (safe delete). A built Player is removed fully: their matches go
// first (FK from Match.playerA/B is RESTRICT; deleting the match cascades to
// Game/GameDeck), then the Player (cascades DivisionMember / mmrSnapshots /
// strikes, and null-outs any reporter/disputer refs). All in one transaction.
async function removeBotAccount(discordId: string, username: string): Promise<BotRemoval> {
  return prisma.$transaction(async (tx) => {
    const signups = await tx.signup.deleteMany({ where: { discordId } });

    const player = await tx.player.findUnique({ where: { discordId }, select: { id: true } });
    let deletedMatches = 0;
    let deletedPlayer = false;
    if (player) {
      const matches = await tx.match.deleteMany({
        where: { OR: [{ playerAId: player.id }, { playerBId: player.id }] },
      });
      deletedMatches = matches.count;
      await tx.player.delete({ where: { id: player.id } });
      deletedPlayer = true;
    }

    return { discordId, username, removedSignups: signups.count, deletedPlayer, deletedMatches };
  });
}

export async function purgeBotAccounts(client: Client, actor: AuditActor): Promise<BotPurgeResult> {
  // Every distinct id that's entered the league: signups (any round) + players.
  const [signups, players] = await Promise.all([
    prisma.signup.findMany({ distinct: ["discordId"], select: { discordId: true } }),
    prisma.player.findMany({ select: { discordId: true } }),
  ]);
  const ids = [...new Set([...signups, ...players].map((r) => r.discordId))].filter(isDiscordSnowflake);

  const result: BotPurgeResult = { scanned: ids.length, unresolved: 0, removed: [] };

  for (const discordId of ids) {
    let user;
    try {
      user = await client.users.fetch(discordId);
    } catch {
      // Account deleted / not fetchable — can't confirm bot-or-not, so leave it.
      result.unresolved++;
      continue;
    }
    if (!user.bot) continue;

    const removal = await removeBotAccount(discordId, user.username);
    result.removed.push(removal);
    console.log(
      `[bot-purge] removed bot ${user.username} (${discordId}): ` +
        `${removal.removedSignups} signup(s), player=${removal.deletedPlayer}, ${removal.deletedMatches} match(es)`,
    );
    await recordAudit({
      actor,
      action: "league.bot-purge",
      targetType: "DiscordUser",
      targetId: discordId,
      summary: `Removed bot account ${user.username} from the league`,
      metadata: { ...removal },
    });
  }

  return result;
}
