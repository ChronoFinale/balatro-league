// Identify fake/test players so they don't appear in public views.
const PREFIXES = ["mock-", "sim-"] as const;

// Generic so .filter() callers preserve their original element type.
export function isMockPlayer<T extends { discordId: string }>(player: T): boolean {
  return PREFIXES.some((p) => player.discordId.startsWith(p));
}
