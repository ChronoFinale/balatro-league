import {
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from "discord.js";
import { activePublicSeason } from "../active-season.js";
import { getOrCreatePlayer, guildDisplayName } from "../players.js";
import { buildScheduleEmbed } from "../schedule-embed.js";
import type { SlashCommand } from "./types.js";

export const schedule: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("schedule")
    .setDescription("Show your remaining matches in the current season."),

  async execute(interaction: ChatInputCommandInteraction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const me = await getOrCreatePlayer(interaction.user, guildDisplayName(interaction));
    const activeSeason = await activePublicSeason();
    if (!activeSeason) {
      await interaction.editReply("No active season right now.");
      return;
    }

    const embed = await buildScheduleEmbed(me.id);
    if (!embed) {
      await interaction.editReply("You're not in a division this season.");
      return;
    }
    await interaction.editReply({ embeds: [embed] });
  },
};
