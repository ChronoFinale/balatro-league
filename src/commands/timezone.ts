import {
  MessageFlags,
  SlashCommandBuilder,
  type AutocompleteInteraction,
  type ChatInputCommandInteraction,
} from "discord.js";
import { prisma } from "../db.js";
import { getOrCreatePlayer, guildDisplayName } from "../players.js";
import { formatZone, isValidTimezone, searchTimezones } from "../timezones.js";
import type { SlashCommand } from "./types.js";

// Sentinel value for the "clear my timezone" autocomplete entry.
const CLEAR = "__clear__";

// /timezone — set or view your own timezone. Running the command (and picking a
// zone) IS the consent: nothing is stored unless you actively choose one, and
// "Clear" removes it. The same field is also settable on the website (where the
// browser can auto-detect it). Shown to opponents on /schedule — server members
// only.
export const timezone: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName("timezone")
    .setDescription("Set or view your timezone — shown to opponents when scheduling (server members only).")
    .addStringOption((opt) =>
      opt
        .setName("zone")
        .setDescription("Start typing your city/region. Leave empty to view your current one.")
        .setAutocomplete(true)
        .setRequired(false),
    ),

  async execute(interaction: ChatInputCommandInteraction) {
    const me = await getOrCreatePlayer(interaction.user, guildDisplayName(interaction));
    const zone = interaction.options.getString("zone");

    // No zone → just show what they currently have.
    if (!zone) {
      const content = me.timezone
        ? `🕐 Your timezone is **${formatZone(me.timezone)}**.\nRun \`/timezone\` and pick another to change it, or choose **Clear** to remove it.`
        : `You haven't set a timezone. Run \`/timezone\` and start typing your city/region — it's shown to opponents when you schedule (server members only). You can also set it on the website.`;
      await interaction.reply({ content, flags: MessageFlags.Ephemeral });
      return;
    }

    // Clear.
    if (zone === CLEAR) {
      await prisma.player.update({ where: { id: me.id }, data: { timezone: null } });
      await interaction.reply({
        content: "✅ Cleared your timezone — it's no longer shown to anyone.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // Set — validate against the IANA list so we never store junk.
    if (!isValidTimezone(zone)) {
      await interaction.reply({
        content: "That isn't a timezone I recognize. Run `/timezone` again and pick one from the suggestions.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    await prisma.player.update({ where: { id: me.id }, data: { timezone: zone } });
    await interaction.reply({
      content: `✅ Timezone set to **${formatZone(zone)}**. Opponents see this when scheduling (server members only). Run \`/timezone\` → **Clear** to remove it anytime.`,
      flags: MessageFlags.Ephemeral,
    });
  },

  async autocomplete(interaction: AutocompleteInteraction) {
    const focused = interaction.options.getFocused();
    const choices = searchTimezones(focused, 25).map((z) => ({ name: z, value: z }));
    // Surface "Clear" at the top when the box is empty (harmless no-op if they
    // have none set) — keeps autocomplete free of a per-keystroke DB lookup.
    if (!focused.trim()) {
      await interaction.respond([{ name: "❌ Clear my timezone", value: CLEAR }, ...choices].slice(0, 25));
      return;
    }
    await interaction.respond(choices);
  },
};
