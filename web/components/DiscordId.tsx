// Inline Discord-ID chip rendered next to a player's name. Always emitted into
// the markup; visibility is controlled app-wide by CSS off the body
// `show-discord-ids` class (set from the ⚙️ per-browser preference in the root
// layout). So pages just render <DiscordId value={p.discordId} /> next to a
// name and never have to thread the toggle state down themselves.
//
// `user-select: all` (in globals.css) makes a single click select the whole id
// for easy copy. Renders nothing for an empty/missing id.
export function DiscordId({ value }: { value: string | null | undefined }) {
  if (!value) return null;
  return (
    <span className="discord-id" title="Discord ID (click to select)">
      {value}
    </span>
  );
}
