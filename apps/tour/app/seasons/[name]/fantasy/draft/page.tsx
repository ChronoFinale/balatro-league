import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gamepad2 } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getFantasyDraftBoard } from "@/lib/services/fantasy";
import { LiveRefresh } from "@/components/LiveRefresh";
import { ElapsedClock } from "@/components/ElapsedClock";
import { Callout } from "@/components/Callout";
import { SubmitButton } from "@/components/SubmitButton";
import { makePickAction } from "../actions";

export const dynamic = "force-dynamic";

const ord = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
};

// The live human snake draft. The on-the-clock manager picks from the real pool; everyone
// else watches (SSE refresh). Mirrors the real draft board; no deadline (the clock is cosmetic).
export default async function FantasyDraftBoard({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const seasonName = decodeURIComponent(name);
  const enc = encodeURIComponent(seasonName);

  const viewer = await getViewer();
  // getFantasyDraftBoard can throw if the pool vanished (real draft reset) - degrade to the
  // hub rather than an error page, matching the public/admin pages.
  let board;
  try {
    board = await getFantasyDraftBoard(seasonName);
  } catch {
    board = null;
  }
  // No league, or the draft hasn't started -> the public hub handles that state.
  if (!board || board.state === "OPEN") redirect(`/seasons/${enc}/fantasy`);

  const done = board.state === "DONE";
  const myTurn = !done && !!viewer.discordId && board.current?.managerDiscordId === viewer.discordId;

  return (
    <main>
      {!done && <LiveRefresh channel={`fantasy:${board.seasonId}`} />}
      <p><Link href={`/seasons/${enc}/fantasy`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> Fantasy</Link></p>
      <h1 className="flex items-center gap-2"><Gamepad2 className="size-6" /> Fantasy draft</h1>
      <p className="sub">{board.teams.length} managers - roster {board.rosterSize} - {board.madePicks} / {board.totalPicks} picks made.</p>

      {done ? (
        <Callout type="success">Draft complete - all {board.totalPicks} picks are in. Standings are live on the <Link href={`/seasons/${enc}/fantasy`}>Fantasy page</Link>.</Callout>
      ) : board.current ? (
        <div className="card card-accent">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--accent)" }}>On the clock</div>
              <div style={{ fontWeight: 700, fontSize: 20 }}>
                {board.current.managerName}{" "}
                <span style={{ color: "var(--muted)", fontWeight: 400 }}>R{board.current.round} - {board.current.overall}{ord(board.current.overall)} overall</span>
              </div>
              {board.current.onClockSince && (
                <div style={{ color: "var(--accent)", fontSize: 14 }}>
                  <ElapsedClock since={board.current.onClockSince.toISOString()} />
                </div>
              )}
            </div>
            {myTurn && <span className="pill" style={{ background: "var(--accent-2)", color: "#fff" }}>Your pick</span>}
          </div>
          {board.upcoming.length > 0 && (
            <div className="sub" style={{ marginTop: 6 }}>
              Up next: {board.upcoming.map((u) => `${u.overall}. ${u.managerName}`).join("  -  ")}
            </div>
          )}
        </div>
      ) : null}

      {/* Rosters */}
      <div className="grid grid-3">
        {board.teams.map((t) => (
          <div key={t.id} className="card" style={{ marginBottom: 0, borderColor: t.onClock ? "var(--accent-2)" : "var(--border)" }}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">{t.name}</div>
              <span className="sub">{t.picks.length} / {board.rosterSize}</span>
            </div>
            <ol style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {t.picks.map((p) => (
                <li key={p.playerId} className="text-sm">
                  {p.name} <span className="muted">{p.teamName ? `- ${p.teamName}` : ""} (seed {p.seed})</span>
                </li>
              ))}
              {t.picks.length === 0 && <li className="sub" style={{ listStyle: "none", marginLeft: -18 }}>no picks yet</li>}
            </ol>
          </div>
        ))}
      </div>

      {/* Pool */}
      {!done && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="bracket-title">Available players ({board.pool.length})</div>
          {myTurn ? (
            <p className="sub" style={{ marginTop: 0 }}>You&apos;re on the clock - click a player to draft them.</p>
          ) : (
            <p className="sub" style={{ marginTop: 0 }}>
              {board.current ? `Waiting on ${board.current.managerName} to pick.` : "Draft paused."} The pool is read-only until it&apos;s your turn.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {board.pool.map((p) =>
              myTurn ? (
                <form key={p.playerId} action={makePickAction} className="inline">
                  <input type="hidden" name="season" value={seasonName} />
                  <input type="hidden" name="playerId" value={p.playerId} />
                  <SubmitButton variant="secondary" size="sm" pendingText="...">{p.name}</SubmitButton>
                </form>
              ) : (
                <span key={p.playerId} className="pill" style={{ background: "var(--surface-2)", border: "1px solid var(--border)", color: "var(--muted)" }}>
                  {p.name}
                </span>
              ),
            )}
            {board.pool.length === 0 && <span className="sub">Everyone&apos;s drafted.</span>}
          </div>
        </div>
      )}
    </main>
  );
}
