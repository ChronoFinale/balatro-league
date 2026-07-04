// /ppt-admin permissions - a permissions doctor. Reports which of the permissions the tour bot
// needs it actually holds in this guild, whether the privileged Server Members intent is on, and
// hands back a ready-to-use re-invite link that requests exactly the right scopes + permissions.
// So you can fix the invite before running /ppt-admin bootstrap (which needs Manage Channels/Roles).
import {
  PermissionFlagsBits,
  GatewayIntentBits,
  OAuth2Scopes,
  MessageFlags,
  type ChatInputCommandInteraction,
} from "discord.js";

// Everything the bot needs across bootstrap (create channels/roles + overwrites), role-sync
// (create/assign roles), and announce/draft posting. NOT Administrator - least privilege.
const REQUIRED: { bit: bigint; name: string }[] = [
  { bit: PermissionFlagsBits.ViewChannel, name: "View Channels" },
  { bit: PermissionFlagsBits.ManageChannels, name: "Manage Channels" },
  { bit: PermissionFlagsBits.ManageRoles, name: "Manage Roles" },
  { bit: PermissionFlagsBits.SendMessages, name: "Send Messages" },
  { bit: PermissionFlagsBits.EmbedLinks, name: "Embed Links" },
  { bit: PermissionFlagsBits.AttachFiles, name: "Attach Files" },
  { bit: PermissionFlagsBits.ReadMessageHistory, name: "Read Message History" },
  { bit: PermissionFlagsBits.AddReactions, name: "Add Reactions" },
  { bit: PermissionFlagsBits.ManageMessages, name: "Manage Messages" },
  { bit: PermissionFlagsBits.UseExternalEmojis, name: "Use External Emojis" },
];

// Pure-ASCII status markers (repo gotcha: literal Unicode injects NUL bytes here). Checkbox
// metaphor reads clearly in Discord without any emoji.
const OK = "[x]";
const NO = "[ ]";

export async function runPermissionsCheck(interaction: ChatInputCommandInteraction): Promise<void> {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.editReply({ content: "You need the Manage Server permission to run this." });
    return;
  }
  const guild = interaction.guild;
  if (!guild) {
    await interaction.editReply({ content: "Run this in the tour server." });
    return;
  }
  const me = guild.members.me ?? (await guild.members.fetchMe().catch(() => null));
  if (!me) {
    await interaction.editReply({ content: "Couldn't read my own membership - try again in a moment." });
    return;
  }

  const rows = REQUIRED.map((p) => `${me.permissions.has(p.bit) ? OK : NO} ${p.name}`);
  const missing = REQUIRED.filter((p) => !me.permissions.has(p.bit)).map((p) => p.name);

  // Privileged Server Members intent is a Developer Portal toggle, NOT grantable by an invite link.
  // We requested it at login with a fallback ladder; if it's on the running client, it was granted.
  const hasMembersIntent = interaction.client.options.intents.has(GatewayIntentBits.GuildMembers);

  const invite = interaction.client.generateInvite({
    scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands],
    permissions: REQUIRED.map((p) => p.bit),
  });

  const intentLine = hasMembersIntent
    ? `${OK} Server Members intent enabled`
    : `${NO} Server Members intent OFF - enable it in the Developer Portal (Bot > Privileged Gateway Intents); an invite link can't grant it, and role removal needs it`;

  const lines = [
    `**Bot permissions in ${guild.name}**`,
    ...rows,
    "",
    missing.length ? `${NO} Missing: ${missing.join(", ")}` : `${OK} All required permissions present.`,
    "",
    intentLine,
    "",
    "__Re-invite with exactly what it needs:__",
    invite,
    "Re-inviting with this link adds the missing permissions without kicking the bot.",
  ];
  await interaction.editReply({ content: lines.join("\n").slice(0, 1990) });
}
