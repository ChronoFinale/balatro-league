import type {
  AutocompleteInteraction,
  ButtonInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
  StringSelectMenuInteraction,
} from "discord.js";

export type CommandBuilder =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

// Where a command is allowed to run. Default ("any") means anywhere in the
// guild. "match-flow" restricts to division channels OR the configured
// bot-commands channel (BOT_COMMANDS_CHANNEL_ID env var) — used for the
// matchmaking commands so they don't get spammed in random channels.
export type ChannelScope = "any" | "match-flow";

export interface SlashCommand {
  data: CommandBuilder;
  // Defaults to "any" when omitted.
  channelScope?: ChannelScope;
  execute(interaction: ChatInputCommandInteraction): Promise<void>;
  autocomplete?(interaction: AutocompleteInteraction): Promise<void>;
}

// Button interactions are routed by customId prefix. Each handler claims a prefix
// (e.g. "report:confirm:") and parses the rest of the customId for its own state.
export interface ButtonHandler {
  prefix: string;
  execute(interaction: ButtonInteraction): Promise<void>;
}

// Same routing model for StringSelectMenu interactions. Multi-pick UIs
// (e.g. the match ban phases) submit one interaction with `values: string[]`
// instead of one button click per choice.
export interface SelectMenuHandler {
  prefix: string;
  execute(interaction: StringSelectMenuInteraction): Promise<void>;
}
