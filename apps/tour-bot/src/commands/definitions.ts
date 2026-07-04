// The /ppt command tree (C4). One top-level command, subcommands grouped under it —
// clean autocomplete, single registration unit. A separate /ppt-admin command holds the
// server-setup tools, hidden from non-managers via ManageGuild default permissions.
import { SlashCommandBuilder, PermissionFlagsBits } from "discord.js";

export function commandDefinitions() {
  const ppt = new SlashCommandBuilder()
    .setName("ppt")
    .setDescription("Pizza Power Team Tour")
    .addSubcommand((s) =>
      s
        .setName("standings")
        .setDescription("Current standings by conference")
        .addStringOption((o) => o.setName("season").setDescription("Season name (default: the live season)")),
    )
    .addSubcommand((s) =>
      s
        .setName("schedule")
        .setDescription("A week's matchups + scores")
        .addIntegerOption((o) => o.setName("week").setDescription("Week number (default: latest)"))
        .addStringOption((o) => o.setName("season").setDescription("Season name (default: the live season)")),
    )
    .addSubcommand((s) =>
      s
        .setName("bracket")
        .setDescription("The playoff bracket")
        .addStringOption((o) => o.setName("season").setDescription("Season name (default: the live season)")),
    )
    .addSubcommand((s) =>
      s
        .setName("fantasy")
        .setDescription("Fantasy league standings")
        .addStringOption((o) => o.setName("season").setDescription("Season name (default: the live season)")),
    )
    .addSubcommand((s) => s.setName("mymatch").setDescription("Your outstanding sets this week"))
    .addSubcommand((s) => s.setName("pickem").setDescription("Make your pick'em predictions"));

  // Server-setup tools. ManageGuild-gated (Discord hides it from non-managers; a runtime
  // check re-verifies). Currently just `bootstrap` — provisions the tour's category/channels/roles.
  const pptAdmin = new SlashCommandBuilder()
    .setName("ppt-admin")
    .setDescription("Team Tour server admin")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((s) =>
      s
        .setName("bootstrap")
        .setDescription("Create the tour's category, channels, and staff roles (idempotent)")
        .addBooleanOption((o) => o.setName("dry-run").setDescription("Preview the changes without touching the server")),
    );

  return [ppt.toJSON(), pptAdmin.toJSON()];
}
