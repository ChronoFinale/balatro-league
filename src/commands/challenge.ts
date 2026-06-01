// /challenge — same ban/pick flow as /start-match but NOT a league match.
// No division or season required, no Pairing written, no announce. Best-of
// is configurable (1, 2, or 3).

import {
  ChannelType,
  MessageFlags,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type TextChannel,
} from "discord.js";
import { CANONICAL_DECKS, CANONICAL_STAKES, isCanonicalDeck } from "../balatro-info.js";
import { prisma } from "../db.js";
import { getLeagueSettings } from "../league-settings.js";
import { DEFAULT_PRESET_NAME, seedDefaultPresetIfEmpty } from "../match-config.js";
import { renderMatch } from "../match-render.js";
import { getOrCreatePlayer } from "../players.js";
import type { SlashCommand } from "./types.js";

const BO_CHOICES = [
  { name: "Best of 1", value: 1 },
  { name: "Best of 2", value: 2 },
  { name: "Best of 3", value: 3 },
] as const;

// Discord allows max 25 choices per option. Our canonical lists fit
// (22 decks, 8 stakes), so static addChoices works without pagination.
const DECK_CHOICES = CANONICAL_DECKS.map((d) => ({ name: d.name, value: d.name }));
const STAKE_CHOICES = CANONICAL_STAKES.map((s) => ({ name: s.name, value: s.name }));

export const challenge: SlashCommand = {
  channelScope: "bot-commands-only",
  data: new SlashCommandBuilder()
    .setName("challenge")
    .setDescription("Casual best-of-N match against another player (not recorded to the league).")
    .addUserOption((opt) =>
      opt.setName("opponent").setDescription("The player you're challenging").setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("best-of")
        .setDescription("Number of games")
        .setRequired(false)
        .addChoices(...BO_CHOICES),
    )
    .addStringOption((opt) =>
      opt
        .setName("deck")
        .setDescription("Skip ban/pick — play this exact deck (must also specify stake)")
        .setRequired(false)
        .addChoices(...DECK_CHOICES),
    )
    .addStringOption((opt) =>
      opt
        .setName("stake")
        .setDescription("Skip ban/pick — play this exact stake (must also specify deck)")
        .setRequired(false)
        .addChoices(...STAKE_CHOICES),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const opponentUser = interaction.options.getUser("opponent", true);
    const bestOf = (interaction.options.getInteger("best-of") ?? 2) as 1 | 2 | 3;
    const customDeck = interaction.options.getString("deck") ?? null;
    const customStake = interaction.options.getString("stake") ?? null;
    // Both must be set or neither — half-specified is admin-confusing.
    if ((customDeck && !customStake) || (!customDeck && customStake)) {
      await interaction.reply({
        content: "If you're skipping ban/pick, specify BOTH deck and stake (or neither).",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Deck must be in our canonical registry. Choices array already
    // restricts to canonical, so this is a belt-and-suspenders check
    // for hand-crafted interactions.
    if (customDeck && !isCanonicalDeck(customDeck)) {
      await interaction.reply({
        content: `"${customDeck}" isn't a recognized deck. Pick one from the dropdown.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    // Stake must be allowed by the Default preset (casual matches use it).
    if (customStake) {
      await seedDefaultPresetIfEmpty();
      const preset = await prisma.matchConfigPreset.findUnique({ where: { name: DEFAULT_PRESET_NAME } });
      if (!preset || !preset.stakes.includes(customStake)) {
        await interaction.reply({
          content: `"${customStake}" stake isn't in the Default preset — pick one from the dropdown.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
    }

    if (opponentUser.id === interaction.user.id) {
      await interaction.reply({ content: "Can't challenge yourself.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (opponentUser.bot) {
      await interaction.reply({ content: "Opponents must be real players, not bots.", flags: MessageFlags.Ephemeral });
      return;
    }
    if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
      await interaction.reply({ content: "Run this in a regular text channel.", flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply();

    const me = await getOrCreatePlayer(interaction.user);
    const opp = await getOrCreatePlayer(opponentUser);

    // Refuse if there's an in-flight session between them (league OR casual)
    const inFlight = await prisma.matchSession.findFirst({
      where: {
        OR: [
          { playerAId: me.id, playerBId: opp.id },
          { playerAId: opp.id, playerBId: me.id },
        ],
        state: { notIn: ["COMPLETE", "CANCELLED"] },
      },
    });
    if (inFlight) {
      await interaction.editReply(
        `There's already an active match between you two (${inFlight.id}). Finish it or have an admin cancel it before starting another.`,
      );
      return;
    }

    // Casual session — no division, no season.
    const settings = await getLeagueSettings();
    const expiresAt = new Date(Date.now() + settings.matchInviteExpiryMinutes * 60 * 1000);
    const session = await prisma.matchSession.create({
      data: {
        playerAId: me.id,
        playerBId: opp.id,
        state: "WAITING_ACCEPT",
        channelId: interaction.channelId,
        isCasual: true,
        bestOf,
        expiresAt,
        customCombo: customDeck && customStake
          ? JSON.stringify({ deck: customDeck, stake: customStake })
          : null,
      },
    });

    const { embeds, components } = renderMatch(session, me, opp);
    const message = await (interaction.channel as TextChannel).send({ embeds, components });
    await interaction.editReply(`Challenge posted (Best of ${bestOf}): ${message.url}`);
  },
};
