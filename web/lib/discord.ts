// Thin Discord REST helpers used by the web app.
// We don't want a full discord.js client here (heavy, expects a long-running
// gateway connection). We just need HTTP calls authenticated with the bot token.

const BASE_URL = "https://discord.com/api/v10";

function botAuthHeader(): string {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN env var not set");
  return `Bot ${token}`;
}

interface DiscordMember {
  user?: { id: string; username: string };
  nick?: string | null;
  roles: string[]; // role IDs the member has in this guild
}

// Fetch a guild member. Returns null if the user isn't in the guild
// (Discord returns 404) or if the bot doesn't have access.
export async function fetchGuildMember(
  guildId: string,
  userId: string,
): Promise<DiscordMember | null> {
  const res = await fetch(`${BASE_URL}/guilds/${guildId}/members/${userId}`, {
    headers: { Authorization: botAuthHeader() },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    console.warn(`Discord fetchGuildMember failed: ${res.status} ${await res.text()}`);
    return null;
  }
  return res.json() as Promise<DiscordMember>;
}

export interface MessageEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
}

// Discord component-v1 (legacy) action row + button JSON shapes.
// type 1 = ActionRow, type 2 = Button. Styles: 1=Primary, 2=Secondary, 3=Success, 4=Danger.
export interface ComponentButton {
  type: 2;
  custom_id: string;
  style: 1 | 2 | 3 | 4;
  label: string;
  disabled?: boolean;
}
export interface ComponentActionRow {
  type: 1;
  components: ComponentButton[];
}

// Post a message to a Discord channel. Returns the new message id on success, null on failure.
export async function postChannelMessage(
  channelId: string,
  payload: { content?: string; embeds?: MessageEmbed[]; components?: ComponentActionRow[] },
): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/channels/${channelId}/messages`, {
    method: "POST",
    headers: {
      Authorization: botAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.warn(`Discord postChannelMessage failed: ${res.status} ${await res.text()}`);
    return null;
  }
  const body = (await res.json()) as { id?: string };
  return body.id ?? null;
}

interface DiscordChannel {
  id: string;
  name: string;
  type: number;       // 0 = GuildText, 5 = Announcement, others = ignore
  parent_id?: string | null;
  position?: number;
}

// List text-like channels in a guild. Used by the admin signup-create form
// so admins can pick a channel without having to copy/paste an ID.
export async function listGuildTextChannels(guildId: string): Promise<DiscordChannel[]> {
  const res = await fetch(`${BASE_URL}/guilds/${guildId}/channels`, {
    headers: { Authorization: botAuthHeader() },
    cache: "no-store",
  });
  if (!res.ok) {
    console.warn(`Discord listGuildTextChannels failed: ${res.status} ${await res.text()}`);
    return [];
  }
  const all = (await res.json()) as DiscordChannel[];
  return all
    .filter((c) => c.type === 0 || c.type === 5)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
}
