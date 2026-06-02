import {
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type ModalSubmitInteraction,
} from "discord.js";
import { enqueueAnnounceResult } from "../queue.js";
import { prisma } from "../db.js";
import { spawnDisputeThread } from "../dispute-thread.js";
import { getOrCreatePlayer } from "../players.js";
import { enqueueReportAutoConfirm } from "../queue.js";
import { buildReportEmbed, postPendingReport } from "../report-flow.js";
import { confirmSet, disputeSet, reportSet } from "../reporting.js";
import { recomputeDivisionStandings } from "../standings-cache.js";
import type { ButtonHandler, ModalHandler, SlashCommand } from "./types.js";

const RESULT_CHOICES = [
  { name: "2-0 (I won both games)", value: "2-0" },
  { name: "1-1 (we drew)", value: "1-1" },
  { name: "0-2 (I lost both games)", value: "0-2" },
] as const;

export const report: SlashCommand = {
  channelScope: "bot-commands-only",
  data: new SlashCommandBuilder()
    .setName("report")
    .setDescription("Report the result of your best-of-2 match against an opponent.")
    .addUserOption((opt) =>
      opt.setName("opponent").setDescription("The player you faced").setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("result")
        .setDescription("Result from YOUR point of view")
        .setRequired(true)
        .addChoices(...RESULT_CHOICES),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const opponentUser = interaction.options.getUser("opponent", true);
    const resultStr = interaction.options.getString("result", true);
    if (!["2-0", "1-1", "0-2"].includes(resultStr)) {
      await interaction.reply({
        content: `Invalid result \`${resultStr}\`. Use 2-0, 1-1, or 0-2.`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (opponentUser.bot) {
      await interaction.reply({
        content: "Opponents must be real players, not bots.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const reporter = await getOrCreatePlayer(interaction.user);
    const opponent = await getOrCreatePlayer(opponentUser);

    const r = await reportSet({
      reporterPlayerId: reporter.id,
      opponentPlayerId: opponent.id,
      result: resultStr as "2-0" | "1-1" | "0-2",
    });
    if (!r.ok) {
      await interaction.editReply(r.reason);
      return;
    }

    // Post the public PENDING embed to #results + schedule the 2-min
    // auto-confirm fallback. If the post fails, auto-confirm still fires
    // from the pg-boss queue — reporter just doesn't get a confirm/dispute
    // button visible to the opponent.
    await postPendingReport(r.pairingId);
    await enqueueReportAutoConfirm(r.pairingId);

    await interaction.editReply(
      `📝 Reported. Your opponent has 2 minutes in #results to confirm or dispute — if they don't respond, it auto-confirms.`,
    );
  },
};

// Button handler: customIds are "report:confirm:<pairingId>" or "report:dispute:<pairingId>"
export const reportButtons: ButtonHandler = {
  prefix: "report:",
  async execute(interaction: ButtonInteraction) {
    const parts = interaction.customId.split(":");
    const action = parts[1];
    const pairingId = parts[2];
    if (!pairingId || (action !== "confirm" && action !== "dispute")) {
      await interaction.reply({ content: "This button looks broken — refresh Discord and try again.", flags: MessageFlags.Ephemeral });
      return;
    }

    // Dispute opens a modal so the player can supply a reason + propose
    // what the result should be. Bot processes the modal-submit
    // interaction below (disputeModal). Confirm is fire-and-forget as
    // before.
    if (action === "dispute") {
      const modal = buildDisputeModal(pairingId);
      await interaction.showModal(modal);
      return;
    }

    const actor = await getOrCreatePlayer(interaction.user);
    const r = await confirmSet(pairingId, actor.id);
    if (!r.ok) {
      await interaction.reply({ content: r.reason, flags: MessageFlags.Ephemeral });
      return;
    }

    const pairing = await prisma.pairing.findUnique({
      where: { id: pairingId },
      include: { playerA: true, playerB: true, division: true },
    });
    if (!pairing) return;

    const reporterIsA = pairing.reporterId === pairing.playerAId;
    const reporter = reporterIsA ? pairing.playerA : pairing.playerB;
    const opponent = reporterIsA ? pairing.playerB : pairing.playerA;

    // confirmSet already wrote status=CONFIRMED + recompute. Fire the
    // announce here so the results-channel post + standings page
    // align. Edit the embed to drop the buttons and show outcome.
    enqueueAnnounceResult(pairingId).catch(() => {});
    recomputeDivisionStandings(pairing.divisionId).catch(() => {});
    const embed = buildReportEmbed({
      status: "CONFIRMED",
      reporter,
      opponent,
      divisionName: pairing.division.name,
      result: { gamesWonA: pairing.gamesWonA, gamesWonB: pairing.gamesWonB },
      reporterIsA,
      pairingId: pairing.id,
    });
    await interaction.update({ content: "", embeds: [embed], components: [] });
  },
};

// Dispute modal — three fields, all optional but at least one filled
// is helpful. Reason is what helper sees first; proposed result lets
// the admin one-click accept via /admin/disputes if it agrees with
// the player's interpretation.
function buildDisputeModal(pairingId: string): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(`dispute-modal:${pairingId}`)
    .setTitle("Dispute this result");
  const reasonInput = new TextInputBuilder()
    .setCustomId("reason")
    .setLabel("Why is the result wrong?")
    .setPlaceholder("Game 2 ended differently than reported, opponent miscounted, etc.")
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(false);
  const proposedInput = new TextInputBuilder()
    .setCustomId("proposed")
    .setLabel("What SHOULD it be? (2-0, 1-1, 0-2, or blank)")
    .setPlaceholder("Type 2-0 if you won both, 1-1 if it was a draw, 0-2 if you lost both")
    .setStyle(TextInputStyle.Short)
    .setMaxLength(10)
    .setRequired(false);
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(proposedInput),
  );
  return modal;
}

// Modal submit handler — parses the reason + proposed result, calls
// disputeSet with both, updates the original message in place.
export const disputeModal: ModalHandler = {
  prefix: "dispute-modal:",
  async execute(interaction: ModalSubmitInteraction) {
    const pairingId = interaction.customId.split(":")[1];
    if (!pairingId) {
      await interaction.reply({ content: "Modal looks broken — refresh Discord and try again.", flags: MessageFlags.Ephemeral });
      return;
    }
    const reason = interaction.fields.getTextInputValue("reason").trim();
    const proposedRaw = interaction.fields.getTextInputValue("proposed").trim();
    // Parse the proposed result if non-empty. Tolerate 2:0, 2 0, etc.
    let proposedGamesWonA: number | undefined;
    let proposedGamesWonB: number | undefined;
    if (proposedRaw) {
      const match = proposedRaw.match(/^([012])\s*[-:\s]\s*([012])$/);
      if (!match || !match[1] || !match[2]) {
        await interaction.reply({
          content: "Proposed result must be 2-0, 1-1, or 0-2 (or leave it blank).",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      const a = parseInt(match[1], 10);
      const b = parseInt(match[2], 10);
      if (!((a === 2 && b === 0) || (a === 1 && b === 1) || (a === 0 && b === 2))) {
        await interaction.reply({
          content: "Only 2-0, 1-1, or 0-2 are valid match results.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      // The form input is from the DISPUTER'S point of view (they say
      // "I won 2-0"), so map to canonical A/B by checking who they
      // are on the pairing. Lookup the pairing now.
      const p = await prisma.pairing.findUnique({ where: { id: pairingId } });
      if (!p) {
        await interaction.reply({ content: "Match not found.", flags: MessageFlags.Ephemeral });
        return;
      }
      const actor = await getOrCreatePlayer(interaction.user);
      const actorIsA = p.playerAId === actor.id;
      proposedGamesWonA = actorIsA ? a : b;
      proposedGamesWonB = actorIsA ? b : a;
    }

    const actor = await getOrCreatePlayer(interaction.user);
    const r = await disputeSet(pairingId, actor.id, {
      reason: reason || undefined,
      proposedGamesWonA,
      proposedGamesWonB,
    });
    if (!r.ok) {
      await interaction.reply({ content: r.reason, flags: MessageFlags.Ephemeral });
      return;
    }
    const pairing = await prisma.pairing.findUnique({
      where: { id: pairingId },
      include: { playerA: true, playerB: true, division: true },
    });
    if (!pairing) return;
    const reporterIsA = pairing.reporterId === pairing.playerAId;
    const reporter = reporterIsA ? pairing.playerA : pairing.playerB;
    const opponent = reporterIsA ? pairing.playerB : pairing.playerA;
    const embed = buildReportEmbed({
      status: "DISPUTED",
      reporter,
      opponent,
      divisionName: pairing.division.name,
      result: { gamesWonA: pairing.gamesWonA, gamesWonB: pairing.gamesWonB },
      reporterIsA,
      pairingId: pairing.id,
    });
    // The button was attached to the announce embed (or the report
    // embed) — update edits whichever message the modal was launched
    // from. isFromMessage() narrows the type so the update() call is
    // available (only valid for modals shown from a component
    // interaction, which is always our case here).
    if (interaction.isFromMessage()) {
      await interaction.update({ content: "", embeds: [embed], components: [] });
    } else {
      await interaction.reply({ content: "Dispute filed — a helper will look at it shortly.", flags: MessageFlags.Ephemeral });
    }
    spawnDisputeThread(pairing.id, { skipEmbedEdit: true }).catch((err) =>
      console.warn(`[dispute-modal] thread spawn for ${pairingId}:`, err),
    );
  },
};
