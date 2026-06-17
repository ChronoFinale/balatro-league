import "server-only";
import { canSeeUsernames, getHiddenUsernameIds } from "@/lib/usernames";

// Inline Discord @username chip rendered next to a player's name — but ONLY for
// verified server members with the toggle on (canSeeUsernames). For everyone
// else the username is not rendered at all, so it never reaches the page HTML
// (privacy: a logged-out visitor can't view-source to harvest handles). The
// numeric Discord ID is never shown anywhere.
//
// Server component (async) so it can do the per-request membership check
// itself — pages just drop <DiscordId username={p.username} /> next to a name
// and don't thread any auth state. The `value` (numeric id) prop is accepted
// but ignored, so existing call sites don't have to change. NOT usable inside
// client components (it's server-only) — those render the handle inline,
// gated by their own server-provided data.
export async function DiscordId({
  value,
  username,
}: {
  value?: string | null;
  username?: string | null;
}) {
  if (!username) return null;
  if (!(await canSeeUsernames())) return null;
  // Subject opted out → never render their handle, even to an allowed viewer.
  // `value` is the player's discordId (passed by every call site).
  if (value) {
    const hidden = await getHiddenUsernameIds();
    if (hidden.has(value)) return null;
  }
  return (
    <span className="discord-username" title="Discord username">
      (@{username})
    </span>
  );
}
