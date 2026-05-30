"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { postChannelMessage, type ComponentActionRow, type MessageEmbed } from "@/lib/discord";

// Mirrors src/signup.ts signupEmbed/signupButtons, expressed as plain JSON
// for the REST API (web doesn't have discord.js).
function buildSignupPayload(round: { id: string; name: string }): {
  embeds: MessageEmbed[];
  components: ComponentActionRow[];
} {
  const embed: MessageEmbed = {
    title: `🃏  ${round.name}`,
    description: "Click below to register. Withdraw anytime before sign-ups close.",
    fields: [
      { name: "Status", value: "**0 signed up**", inline: false },
      { name: "Players", value: "_No one yet — be the first!_", inline: false },
    ],
    color: 0x5865f2,
    footer: { text: `Round ${round.id}` },
  };
  const row: ComponentActionRow = {
    type: 1,
    components: [
      { type: 2, custom_id: `signup:join:${round.id}`, style: 3, label: "Sign Up" },
      { type: 2, custom_id: `signup:withdraw:${round.id}`, style: 2, label: "Withdraw" },
    ],
  };
  return { embeds: [embed], components: [row] };
}

export async function createRound(formData: FormData) {
  await requireAdmin();

  const name = String(formData.get("name") ?? "").trim();
  const channelId = String(formData.get("channelId") ?? "").trim();
  if (!name) redirect("/admin/signups/new?err=missing-name");
  if (!channelId) redirect("/admin/signups/new?err=missing-channel");

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) redirect("/admin/signups?err=no-guild-id");

  // Create the round first with a placeholder message id, post to Discord, then patch the id in.
  // Matches /league post-signup flow in src/commands/league.ts.
  const round = await prisma.signupRound.create({
    data: {
      name,
      guildId,
      channelId,
      messageId: "pending",
    },
  });

  const payload = buildSignupPayload(round);
  const messageId = await postChannelMessage(channelId, payload);

  if (!messageId) {
    // Discord post failed — clean up the orphan round so admin can retry.
    await prisma.signupRound.delete({ where: { id: round.id } });
    redirect("/admin/signups/new?err=post-failed");
  }

  await prisma.signupRound.update({
    where: { id: round.id },
    data: { messageId },
  });

  revalidatePath("/admin/signups");
  redirect("/admin/signups");
}
