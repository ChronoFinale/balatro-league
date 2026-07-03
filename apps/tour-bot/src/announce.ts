// #results embeds. The web supplies the payload (/api/bot/announce/*); this file only
// renders + posts. Channel id comes from TourConfig key "channel.results" — if unset,
// we log and complete the job (no retry storm; the admin sets the channel and future
// results announce normally).
import { EmbedBuilder, type Client, type TextChannel } from "discord.js";
import { env } from "./env";
import { apiGet } from "./api";

interface SetPayload {
  seasonName: string;
  week: number | null;
  bracket: string | null;
  forfeit: boolean;
  winnerName: string;
  loserName: string;
  winnerGames: number;
  loserGames: number;
  winnerTeam: string | null;
  loserTeam: string | null;
  games: { num: number; deck: string | null; stake: string | null; winnerName: string | null }[];
  urlPath: string;
}

interface MatchupPayload {
  seasonName: string;
  week: number;
  teamA: string;
  teamB: string;
  setsA: number;
  setsB: number;
  winnerTeam: string | null;
  urlPath: string;
}

async function resultsChannel(client: Client): Promise<TextChannel | null> {
  const cfg = await apiGet<{ key: string; value: string | null }>("/api/bot/config?key=channel.results");
  if (!cfg.value) {
    console.warn("[announce] channel.results not configured — set it at /admin/config");
    return null;
  }
  const ch = await client.channels.fetch(cfg.value).catch(() => null);
  if (!ch || !ch.isTextBased() || ch.isDMBased()) {
    console.warn(`[announce] channel.results (${cfg.value}) not found / not a text channel`);
    return null;
  }
  return ch as TextChannel;
}

export async function announceSet(client: Client, setId: string): Promise<void> {
  const p = await apiGet<SetPayload>(`/api/bot/announce/set/${setId}`);
  const ch = await resultsChannel(client);
  if (!ch) return;
  const title = p.forfeit
    ? `${p.winnerName} def. ${p.loserName} by forfeit`
    : `${p.winnerName} def. ${p.loserName} ${p.winnerGames}-${p.loserGames}`;
  const teamLine = p.winnerTeam && p.loserTeam ? `${p.winnerTeam} vs ${p.loserTeam}` : null;
  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle(title)
    .setDescription(
      [
        `${p.seasonName}${p.week != null ? ` - Week ${p.week}` : ""}${p.bracket === "PLAYOFF" ? " - PLAYOFFS" : ""}`,
        teamLine,
        p.games.length
          ? p.games.map((g) => `G${g.num}: ${g.winnerName ?? "?"}${g.deck ? ` (${g.deck}${g.stake ? `/${g.stake}` : ""})` : ""}`).join(" - ")
          : null,
      ]
        .filter(Boolean)
        .join("\n"),
    )
    .setURL(`${env.TOUR_WEB_URL}${p.urlPath}`)
    .setTimestamp(new Date());
  await ch.send({ embeds: [embed] });
}

export async function announceMatchup(client: Client, matchupId: string): Promise<void> {
  const p = await apiGet<MatchupPayload>(`/api/bot/announce/matchup/${matchupId}`);
  const ch = await resultsChannel(client);
  if (!ch) return;
  const title =
    p.winnerTeam != null
      ? `${p.winnerTeam} take the Week ${p.week} matchup ${Math.max(p.setsA, p.setsB)}-${Math.min(p.setsA, p.setsB)}`
      : `${p.teamA} and ${p.teamB} tie Week ${p.week} ${p.setsA}-${p.setsB}`;
  const embed = new EmbedBuilder()
    .setColor(0x9b59b6)
    .setTitle(title)
    .setDescription(`${p.seasonName} - ${p.teamA} vs ${p.teamB}`)
    .setURL(`${env.TOUR_WEB_URL}${p.urlPath}`)
    .setTimestamp(new Date());
  await ch.send({ embeds: [embed] });
}
