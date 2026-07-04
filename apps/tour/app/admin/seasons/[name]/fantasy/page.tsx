import Link from "next/link";
import { ArrowLeft, ExternalLink, Trash2, Gamepad2 } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { getSeasonAdmin } from "@/lib/services/seasons";
import { getFantasyLeague, getFantasyPool, getFantasyDraftBoard } from "@/lib/services/fantasy";
import { Callout } from "@/components/Callout";
import { ActionFlashForm } from "@/components/ActionFlashForm";
import { FormSelect } from "@/components/FormSelect";
import { SubmitButton } from "@/components/SubmitButton";
import { ConfirmButton } from "@/components/ConfirmButton";
import { Label } from "@/components/ui/label";
import { openFantasyAction, startDraftAction, deleteFantasyTeamAction } from "./actions";

export const dynamic = "force-dynamic";

const inputCls = "rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1";

// Fantasy admin: open a league, manage the manager list pre-draft, start the snake draft.
// The manager DRAFT itself happens on the public board (managers pick when on the clock).
export default async function FantasyAdmin({ params }: { params: Promise<{ name: string }> }) {
  if (!(await isAdmin())) {
    return (
      <main>
        <h1>Admin</h1>
        <Callout type="admin">Admins only - you don&apos;t have access.</Callout>
      </main>
    );
  }

  const { name } = await params;
  const seasonName = decodeURIComponent(name);
  const enc = encodeURIComponent(seasonName);
  const data = await getSeasonAdmin(seasonName);
  if (!data) {
    return (
      <main>
        <p><Link href="/admin" className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> admin</Link></p>
        <h1>Season not found</h1>
      </main>
    );
  }
  const { season } = data;

  // The pool is set by the REAL draft - no draft, no fantasy.
  let poolSize: number | null = null;
  try {
    poolSize = (await getFantasyPool(seasonName)).length;
  } catch {
    poolSize = null;
  }

  const league = await getFantasyLeague(seasonName);
  // Only build the board when the real draft (pool) still exists - if it was reset out from
  // under an open league, poolSize is null and we render the "run the draft first" guard below.
  const board = league && poolSize != null ? await getFantasyDraftBoard(seasonName) : null;

  return (
    <main>
      <p>
        <Link href={`/admin/seasons/${enc}`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> {seasonName}</Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-2"><Gamepad2 className="size-6" /> Fantasy</h1>
        {league && (
          <Link href={`/seasons/${enc}/fantasy`} className="inline-flex items-center gap-1 text-sm">
            Public page <ExternalLink className="size-3.5" />
          </Link>
        )}
      </div>
      <p className="sub">
        A meta-game: managers draft a roster of real players (snake order, no seed limit) and score
        from their real results. Set win = points, plus a point per game won.
      </p>

      {poolSize == null ? (
        <Callout type="info">
          The fantasy pool comes from the real draft - run the <Link href={`/admin/seasons/${enc}/draft`}>Draft</Link> first,
          then open a fantasy league here.
        </Callout>
      ) : !league ? (
        <div className="card">
          <div className="bracket-title">Open a fantasy league</div>
          <p className="sub" style={{ marginTop: 0 }}>
            Pool of {poolSize} players - up to {Math.floor(poolSize / season.teamSize)} managers at the default roster
            of {season.teamSize}.
          </p>
          <ActionFlashForm action={openFantasyAction} className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="season" value={seasonName} />
            <div className="grid gap-1.5">
              <Label>Scope</Label>
              <FormSelect
                name="scope"
                defaultValue="SEASON"
                options={[
                  { value: "SEASON", label: "Whole season - every set scores" },
                  { value: "PLAYOFFS", label: "Playoffs only - eliminated players are done" },
                ]}
                triggerClassName="w-72"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="rosterSize">Roster size</Label>
              <input id="rosterSize" type="number" name="rosterSize" min={1} max={30} placeholder={String(season.teamSize)} className={inputCls} style={{ width: 90 }} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="setWinPoints">Set win pts</Label>
              <input id="setWinPoints" type="number" name="setWinPoints" min={0} max={100} defaultValue={1} className={inputCls} style={{ width: 90 }} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="gameWinPoints">Game win pts</Label>
              <input id="gameWinPoints" type="number" name="gameWinPoints" min={0} max={100} defaultValue={1} className={inputCls} style={{ width: 90 }} />
            </div>
            <SubmitButton pendingText="Opening...">Open league</SubmitButton>
          </ActionFlashForm>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="bracket-title">Managers</div>
            <p className="sub" style={{ marginTop: 0 }}>
              {board!.teams.length} of up to {board!.cap} - {league.scope === "PLAYOFFS" ? "playoffs-only" : "whole-season"} scoring,
              roster {league.rosterSize}. Managers join themselves from the{" "}
              <Link href={`/seasons/${enc}/fantasy`}>public page</Link>.
            </p>
            {board!.teams.length === 0 ? (
              <p className="sub" style={{ margin: 0 }}>No managers yet - share the public page so people can join.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table>
                  <thead>
                    <tr>
                      <th className="num">#</th>
                      <th>Manager</th>
                      <th>Roster</th>
                      {board!.state === "OPEN" && <th>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {board!.teams.map((t) => (
                      <tr key={t.id}>
                        <td className="num">{t.joinOrder}</td>
                        <td>{t.name}</td>
                        <td className="sub">{t.picks.length} / {league.rosterSize}</td>
                        {board!.state === "OPEN" && (
                          <td>
                            <form action={deleteFantasyTeamAction} className="inline">
                              <input type="hidden" name="season" value={seasonName} />
                              <input type="hidden" name="teamId" value={t.id} />
                              <ConfirmButton message={`Remove ${t.name} from the fantasy league?`} variant="destructive" size="sm">
                                <Trash2 className="size-3.5" />
                              </ConfirmButton>
                            </form>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {board!.state === "OPEN" ? (
            <div className="card">
              <div className="bracket-title">Start the draft</div>
              {board!.teams.length < 2 ? (
                <p className="sub" style={{ margin: 0 }}>Need at least 2 managers before the draft can start.</p>
              ) : (
                <>
                  <p className="sub" style={{ marginTop: 0 }}>
                    Locks the manager list and freezes the snake order (join order). Manager 1 goes on the clock;
                    everyone drafts from the public board.
                  </p>
                  <ActionFlashForm action={startDraftAction}>
                    <input type="hidden" name="season" value={seasonName} />
                    <SubmitButton pendingText="Starting...">Start snake draft</SubmitButton>
                  </ActionFlashForm>
                </>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="bracket-title">Draft {board!.state === "DONE" ? "complete" : "in progress"}</div>
              <p className="sub" style={{ marginTop: 0 }}>
                {board!.madePicks} / {board!.totalPicks} picks made.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href={`/seasons/${enc}/fantasy/draft`} className="inline-flex items-center gap-1">Live draft board <ExternalLink className="size-3.5" /></Link>
                <Link href={`/seasons/${enc}/fantasy`} className="inline-flex items-center gap-1">Standings <ExternalLink className="size-3.5" /></Link>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
