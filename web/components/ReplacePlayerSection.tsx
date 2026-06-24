// Shared "replace a player" UI — used on the season page AND the admin Divisions
// page so the experience is identical in both places. Replaces ANY active player
// (whether they left the server or just aren't going to play) with a new person;
// the replacement inherits the departed's exact schedule. Pre-play only — the
// action refuses if the player being replaced has already played a match.

import { replacePlayer } from "@/app/admin/players/actions";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/FormSelect";

export function ReplacePlayerSection({
  players,
  returnTo,
}: {
  players: { id: string; label: string }[];
  returnTo: string;
}) {
  return (
    <div>
      <strong style={{ fontSize: 13 }}>Replace a player</strong>
      <p className="muted" style={{ fontSize: 12, margin: "2px 0 8px" }}>
        Swap any player out for a new person — whether they left the server or just aren&apos;t going to play.
        The replacement inherits the departed&apos;s exact schedule, so nothing else changes. Pre-play only:
        blocked once the player being replaced has a reported result.
      </p>
      {players.length === 0 ? (
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>No active players to replace.</p>
      ) : (
        <form action={replacePlayer} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input type="hidden" name="returnTo" value={returnTo} />
          <FormSelect
            name="departedPlayerId"
            defaultValue=""
            options={[{ value: "", label: "— player to replace —" }, ...players.map((p) => ({ value: p.id, label: p.label }))]}
          />
          <span className="muted" style={{ fontSize: 12 }}>→</span>
          <Input name="newDiscordId" required placeholder="Replacement's Discord ID" className="max-w-52" />
          <ConfirmButton
            message="Replace the selected player with this Discord ID? The new player takes over the exact schedule and gets DM'd it. Blocked if the player being replaced has already played a match."
            variant="secondary"
          >
            Replace
          </ConfirmButton>
        </form>
      )}
    </div>
  );
}
