import Link from "next/link";
import { ArrowLeft, Gamepad2, LogIn, Trophy } from "lucide-react";
import { getViewer } from "@/lib/auth";
import { getFantasyLeague, getFantasyStandings, getFantasyDraftBoard } from "@/lib/services/fantasy";
import { Callout } from "@/components/Callout";
import { ActionFlashForm } from "@/components/ActionFlashForm";
import { SubmitButton } from "@/components/SubmitButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { joinFantasyAction } from "./actions";

export const dynamic = "force-dynamic";

const STATE_LABEL: Record<string, string> = { OPEN: "signups open", DRAFTING: "drafting", DONE: "drafted" };

// Public fantasy hub: derived standings + the self-serve join panel (while OPEN) + a link to
// the live draft board. A meta-game layered on the real results.
export default async function FantasyPublic({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const seasonName = decodeURIComponent(name);
  const enc = encodeURIComponent(seasonName);

  const viewer = await getViewer();
  const league = await getFantasyLeague(seasonName);

  if (!league) {
    return (
      <main>
        <p><Link href={`/seasons/${enc}`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> {seasonName}</Link></p>
        <h1 className="flex items-center gap-2"><Gamepad2 className="size-6" /> Fantasy</h1>
        <Callout type="info">No fantasy league for {seasonName} yet - check back once the roster draft is done.</Callout>
      </main>
    );
  }

  let board;
  let standings;
  try {
    [board, standings] = await Promise.all([getFantasyDraftBoard(seasonName), getFantasyStandings(seasonName)]);
  } catch {
    board = null;
    standings = null;
  }
  if (!board || !standings) {
    return (
      <main>
        <p><Link href={`/seasons/${enc}`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> {seasonName}</Link></p>
        <h1 className="flex items-center gap-2"><Gamepad2 className="size-6" /> Fantasy</h1>
        <Callout type="info">The fantasy pool isn&apos;t available right now.</Callout>
      </main>
    );
  }

  const joined = !!viewer.discordId && board.teams.some((t) => t.managerDiscordId === viewer.discordId);
  const myTurn = board.state === "DRAFTING" && !!viewer.discordId && board.current?.managerDiscordId === viewer.discordId;
  const full = board.teams.length >= board.cap;

  return (
    <main>
      <p><Link href={`/seasons/${enc}`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> {seasonName}</Link></p>
      <h1 className="flex items-center gap-2"><Gamepad2 className="size-6" /> Fantasy</h1>
      <p className="sub">
        {league.scope === "PLAYOFFS" ? "Playoffs-only" : "Whole-season"} scoring - roster of {standings.rosterSize},
        {" "}set win = {league.setWinPoints} pt{league.setWinPoints === 1 ? "" : "s"} plus {league.gameWinPoints}/game won.
        {" "}Draft: {STATE_LABEL[board.state] ?? board.state}.
      </p>

      {myTurn && (
        <Callout type="accent">
          You&apos;re on the clock! <Link href={`/seasons/${enc}/fantasy/draft`}>Make your pick</Link>.
        </Callout>
      )}

      {/* Standings - derived on read from real results */}
      <div className="card" style={{ overflowX: "auto" }}>
        <div className="bracket-title flex items-center gap-2"><Trophy className="size-4" /> Standings</div>
        {standings.setsCounted === 0 && <p className="sub" style={{ marginTop: 0 }}>No scored sets yet - points appear as real matches are decided.</p>}
        <table>
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Manager</th>
              <th className="num">Pts</th>
              <th className="num">Player-sets</th>
            </tr>
          </thead>
          <tbody>
            {standings.standings.map((s, i) => {
              const mine = !!viewer.discordId && s.managerDiscordId === viewer.discordId;
              return (
                <tr key={s.teamId} style={mine ? { background: "var(--surface-2)" } : undefined}>
                  <td className="rank">{i + 1}</td>
                  <td className={mine ? "font-semibold" : undefined}>{s.managerName}{mine ? " (you)" : ""}</td>
                  <td className="num">{s.points}</td>
                  <td className="num">{s.sets}</td>
                </tr>
              );
            })}
            {standings.standings.length === 0 && (
              <tr><td colSpan={4} className="sub">No managers yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Join panel (OPEN only) */}
      {board.state === "OPEN" && (
        <div className="card">
          <div className="bracket-title">Join the league</div>
          {!viewer.discordId ? (
            <p className="sub" style={{ margin: 0 }}>
              <Link href="/auth/signin" className="inline-flex items-center gap-1.5"><LogIn className="size-4" /> Sign in with Discord</Link> to draft a fantasy team.
            </p>
          ) : joined ? (
            <p className="sub" style={{ margin: 0 }}>You&apos;re in - the draft starts when the TO opens it. Watch this page.</p>
          ) : full ? (
            <p className="sub" style={{ margin: 0 }}>The league is full ({board.cap} managers). Ask the TO if a spot opens up.</p>
          ) : (
            <ActionFlashForm action={joinFantasyAction} className="flex flex-wrap items-end gap-3">
              <input type="hidden" name="season" value={seasonName} />
              <div className="grid gap-1.5">
                <Label htmlFor="managerName">Team name</Label>
                <Input id="managerName" name="managerName" placeholder={viewer.name ?? "your name"} maxLength={40} className="w-64" />
              </div>
              <SubmitButton pendingText="Joining...">Join as manager</SubmitButton>
            </ActionFlashForm>
          )}
        </div>
      )}

      {/* Draft link (once started) */}
      {board.state !== "OPEN" && (
        <p>
          <Link href={`/seasons/${enc}/fantasy/draft`} className="inline-flex items-center gap-1.5">
            <Gamepad2 className="size-4" /> {board.state === "DONE" ? "See the draft board" : "Go to the live draft"}
          </Link>
          {" - "}{board.madePicks} / {board.totalPicks} picks made.
        </p>
      )}
    </main>
  );
}
