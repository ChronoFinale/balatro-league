// TourConfig — key/value site+bot configuration (league LeagueConfig pattern).
// Known keys (document new ones here; the admin page lists them):
//   channel.results        — Discord channel id for result announcements
//   channel.draft          — Discord channel id for live draft pick posts + on-clock pings
//   channel.announcements  — Discord channel id for season milestones
//   bot.commandHash        — slash-command registration hash (bot-managed)
import { prisma } from "../db";

export const KNOWN_KEYS: { key: string; hint: string }[] = [
  { key: "channel.results", hint: "channel id for result announcements" },
  { key: "channel.draft", hint: "channel id for live draft posts + on-clock pings" },
  { key: "channel.announcements", hint: "channel id for season milestones" },
];

export async function getConfig(key: string): Promise<string | null> {
  const row = await prisma.tourConfig.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function allConfig(): Promise<Record<string, string>> {
  const rows = await prisma.tourConfig.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export async function setConfig(key: string, value: string): Promise<void> {
  const k = key.trim();
  if (!k) throw new Error("A key is required.");
  const v = value.trim();
  if (!v) {
    await prisma.tourConfig.deleteMany({ where: { key: k } });
    return;
  }
  await prisma.tourConfig.upsert({ where: { key: k }, create: { key: k, value: v }, update: { value: v } });
}
