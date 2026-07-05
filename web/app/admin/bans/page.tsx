import { requireAdmin } from "@/lib/admin";
import { SiteNav } from "@/components/SiteNav";
import { AdminNav } from "@/components/AdminNav";
import { Callout } from "@/components/Callout";
import { Input } from "@/components/ui/input";
import { ConfirmButton } from "@/components/ConfirmButton";
import { PlayerSearch } from "@/components/PlayerSearch";
import { loadAllPlayersForPicker } from "@/lib/loaders/players";
import { loadBannedPlayers } from "@/lib/loaders/bans";
import { banPlayerAction, unbanPlayerAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function BansPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { ok, err } = await searchParams;
  const [players, banned] = await Promise.all([loadAllPlayersForPicker(), loadBannedPlayers()]);

  return (
    <>
      <SiteNav activePath="/admin" />
      <AdminNav activePath="/admin/bans" />
      <main>
        <h2 style={{ margin: 0 }}>🚫 League bans</h2>
        <p className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          A banned player <strong>can&apos;t sign up, be added to a round, opt into reminders, be placed into a
          division, or start/queue any match</strong> (league or casual). A ban does <strong>not</strong> pull them
          out of a season already in progress — for that, use the division <strong>DQ / void</strong> tools. Reasons
          are admin-only.
        </p>

        {err && <Callout type="danger">{err}</Callout>}
        {ok && <Callout type="success">{ok}</Callout>}

        <div className="card">
          <strong>Ban a player</strong>
          <form action={banPlayerAction} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start", marginTop: 8 }}>
            <div style={{ flex: "1 1 220px", minWidth: 200 }}>
              <PlayerSearch players={players} name="playerId" placeholder="Search a player (name / @handle / ID)…" />
            </div>
            <Input type="text" name="reason" placeholder="Reason (admin-only, required)" style={{ flex: "2 1 260px" }} />
            <ConfirmButton message="Ban this player? They won't be able to sign up or play until you unban them.">
              Ban player
            </ConfirmButton>
          </form>
        </div>

        <div className="card">
          <strong>Banned players ({banned.length})</strong>
          {banned.length === 0 ? (
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>Nobody is banned.</p>
          ) : (
            <table style={{ marginTop: 8 }}>
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Reason</th>
                  <th>Banned</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {banned.map((b) => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 500 }}>
                      {b.displayName}
                      <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>{b.discordId}</span>
                    </td>
                    <td className="muted" style={{ fontSize: 13 }}>{b.bannedReason ?? "—"}</td>
                    <td className="muted" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
                      {b.bannedAt.toISOString().slice(0, 10)}
                      {b.bannedBy && <span style={{ marginLeft: 4 }}>by {b.bannedBy}</span>}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <form action={unbanPlayerAction} style={{ display: "inline" }}>
                        <input type="hidden" name="playerId" value={b.id} />
                        <ConfirmButton
                          variant="secondary"
                          message={`Unban ${b.displayName}? They'll be able to sign up and play again.`}
                          style={{ fontSize: 12, padding: "3px 10px" }}
                        >
                          Unban
                        </ConfirmButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </>
  );
}
