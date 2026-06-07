// Shared render for a /support ticket — the embed + Close button shown in the
// ticket thread. Used by the /support command (open) and the support button
// handler (re-render on close), so both stay in sync.

import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from "discord.js";
import type { SupportTicket } from "@prisma/client";

export function supportTicketEmbed(ticket: SupportTicket): EmbedBuilder {
  const open = ticket.status === "OPEN";
  const embed = new EmbedBuilder()
    .setTitle(`🎫 Support ticket #${ticket.id.slice(-6)}`)
    .setColor(open ? 0x5865f2 : 0x99aab5)
    .setDescription(ticket.issue)
    .addFields(
      { name: "From", value: `<@${ticket.requesterId}>`, inline: true },
      { name: "Status", value: open ? "🟢 Open" : "🔴 Closed", inline: true },
    )
    .setFooter({ text: `Ticket ${ticket.id}` })
    .setTimestamp(ticket.createdAt);
  if (!open && ticket.closedById) {
    embed.addFields({ name: "Closed by", value: `<@${ticket.closedById}>`, inline: false });
  }
  return embed;
}

export function supportTicketButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`support:close:${ticketId}`)
      .setLabel("Close ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Secondary),
  );
}
