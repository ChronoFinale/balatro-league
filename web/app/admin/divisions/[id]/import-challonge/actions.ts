"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { addGuildMemberRole } from "@/lib/discord";
import {
  fetchMatches,
  fetchParticipants,
  interpretScore,
  normalizeSlug,
} from "@/lib/challonge";

// Parse the user's name→discord_id mapping textarea.
// Accepts: "Name, 123456789012345678" or "Name 123456789012345678"
// Lines starting with # are skipped.
function parseMapping(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idMatch = trimmed.match(/\d{17,20}/);
    if (!idMatch) continue;
    const id = idMatch[0];
    // Name = everything before the digits, stripped of trailing comma/whitespace
    const beforeId = trimmed.slice(0, trimmed.indexOf(id)).replace(/[,\s]+$/, "");
    if (!beforeId) continue;
    out.set(beforeId.toLowerCase(), id);
  }
  return out;
}

// One-click import: pulls participants + matches from Challonge, maps names
// to Discord IDs via the user-provided CSV, then creates Players +
// DivisionMembers + confirmed Pairings in our DB.
export async function importChallonge(formData: FormData) {
  await requireAdmin();
  const divisionId = String(formData.get("divisionId") ?? "");
  const slugRaw = String(formData.get("slug") ?? "");
  const apiKey = String(formData.get("apiKey") ?? "").trim() || process.env.CHALLONGE_API_KEY || "";
  const mappingRaw = String(formData.get("mapping") ?? "");

  if (!divisionId || !slugRaw || !apiKey || !mappingRaw.trim()) {
    redirect(`/admin/divisions/${divisionId}/import-challonge?err=missing-fields`);
  }

  const slug = normalizeSlug(slugRaw);
  const mapping = parseMapping(mappingRaw);

  const division = await prisma.division.findUnique({ where: { id: divisionId } });
  if (!division) redirect(`/admin/divisions/${divisionId}/import-challonge?err=division-not-found`);

  const guildId = process.env.DISCORD_GUILD_ID;

  let participants, matches;
  try {
    [participants, matches] = await Promise.all([
      fetchParticipants(slug, apiKey),
      fetchMatches(slug, apiKey),
    ]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    redirect(`/admin/divisions/${divisionId}/import-challonge?err=${encodeURIComponent(msg.slice(0, 200))}`);
  }

  // Build participant_id → Player row (by Discord ID), via mapping
  const participantToPlayer = new Map<number, { id: string; discordId: string; displayName: string }>();
  const unmapped: string[] = [];

  for (const p of participants) {
    const discordId = mapping.get(p.name.toLowerCase());
    if (!discordId) {
      unmapped.push(p.name);
      continue;
    }
    const player = await prisma.player.upsert({
      where: { discordId },
      create: { discordId, displayName: p.name },
      update: { displayName: p.name },
    });
    await prisma.divisionMember.upsert({
      where: { divisionId_playerId: { divisionId, playerId: player.id } },
      create: { divisionId, playerId: player.id, status: "ACTIVE" },
      update: { status: "ACTIVE", droppedAt: null, dropoutReason: null },
    });
    participantToPlayer.set(p.id, player);
    if (guildId && division!.discordRoleId) {
      await addGuildMemberRole(guildId, discordId, division!.discordRoleId);
    }
  }

  // Import every completed match where both participants are mapped
  let pairingsRecorded = 0;
  const matchErrors: string[] = [];

  for (const m of matches) {
    if (m.state !== "complete") continue;
    if (!m.player1_id || !m.player2_id) continue;
    const p1 = participantToPlayer.get(m.player1_id);
    const p2 = participantToPlayer.get(m.player2_id);
    if (!p1 || !p2) continue; // one side unmapped — skip silently (counted in `unmapped`)

    const interp = interpretScore(m.scores_csv, m.winner_id, m.player1_id);
    if (!interp.ok) {
      matchErrors.push(`match ${m.id}: ${interp.reason}`);
      continue;
    }

    const result = interp.result;
    const games = result === "2-0" ? { a: 2, b: 0 } : result === "0-2" ? { a: 0, b: 2 } : { a: 1, b: 1 };

    const [canonA, canonB] = p1.id < p2.id ? [p1.id, p2.id] : [p2.id, p1.id];
    const p1IsCanonA = p1.id === canonA;
    const gamesWonA = p1IsCanonA ? games.a : games.b;
    const gamesWonB = p1IsCanonA ? games.b : games.a;

    await prisma.pairing.upsert({
      where: { divisionId_playerAId_playerBId: { divisionId, playerAId: canonA, playerBId: canonB } },
      create: {
        divisionId,
        playerAId: canonA,
        playerBId: canonB,
        gamesWonA,
        gamesWonB,
        status: "CONFIRMED",
        reportedAt: new Date(),
        confirmedAt: new Date(),
      },
      update: {
        gamesWonA,
        gamesWonB,
        status: "CONFIRMED",
        confirmedAt: new Date(),
      },
    });
    pairingsRecorded++;
  }

  const summary = new URLSearchParams({
    added: String(participantToPlayer.size),
    recorded: String(pairingsRecorded),
    unmapped: unmapped.join(", "),
    matchErrors: matchErrors.slice(0, 5).join(" | "),
  }).toString();
  revalidatePath(`/admin/divisions/${divisionId}`);
  redirect(`/admin/divisions/${divisionId}?bulk=${encodeURIComponent(summary)}`);
}
