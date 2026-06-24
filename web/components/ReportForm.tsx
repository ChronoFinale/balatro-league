"use client";

// The single player-facing match-report form, used on /report, /profile, and
// /divisions so reporting looks + behaves identically everywhere (same fields,
// wording, and lives capture). The result dropdown alone ("2-0", "0-2") is
// ambiguous about *who* won, so it shows a live plain-language confirmation
// that names both players before the Report button.
//
// Modes:
//   opponents        — dropdown of opponents to pick from (report/profile)
//   lockedOpponent   — opponent is fixed (a division-row "Report vs X"); no dropdown
//   compact          — tighter layout + smaller controls for inline/row use
//   collapsible      — render a "Report" trigger that expands the form on click
//   hiddenFields     — extra context fields the server action needs (e.g.
//                      divisionId, profileId), mirrored into hidden inputs
//
// Built with shadcn/ui (Radix Select) + Tailwind. Radix Select isn't a native
// <select name>, so chosen values are mirrored into hidden inputs — the server
// action reads the same FormData keys regardless of mode, rules unchanged.

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { resultLabelBySelf, type ResultStr } from "@/lib/result-labels";

export interface ReportOpponent {
  playerId: string;
  displayName: string;
  alreadyPending: boolean;
}

// Radix Select disallows empty-string item values, so optional deck/stake use a
// sentinel that maps back to "" in the hidden input.
const NONE = "__none__";

// One optional deck/stake dropdown. Used twice per game (deck + stake), twice
// over (game 1 + game 2), so it's factored out.
function ComboSelect({
  value,
  onChange,
  options,
  placeholder,
  width,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  width: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v ?? NONE)}>
      <SelectTrigger className={width}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>{placeholder}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>{o}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ReportForm({
  opponents = [],
  lockedOpponent,
  decks,
  stakes,
  action,
  compact = false,
  collapsible = false,
  hiddenFields,
}: {
  opponents?: ReportOpponent[];
  lockedOpponent?: ReportOpponent;
  decks: string[];
  stakes: string[];
  action: (formData: FormData) => void | Promise<void>;
  compact?: boolean;
  collapsible?: boolean;
  hiddenFields?: Record<string, string>;
}) {
  const [opponentId, setOpponentId] = useState(lockedOpponent?.playerId ?? "");
  const [result, setResult] = useState<ResultStr>("2-0");
  // Selected deck/stake per game — index 0 = game 1, 1 = game 2. (The `decks` /
  // `stakes` props are the available OPTIONS; these are the chosen values.)
  const [gameDecks, setGameDecks] = useState<[string, string]>([NONE, NONE]);
  const [gameStakes, setGameStakes] = useState<[string, string]>([NONE, NONE]);
  const setDeckAt = (i: number, v: string) =>
    setGameDecks((d) => (i === 0 ? [v, d[1]] : [d[0], v]));
  const setStakeAt = (i: number, v: string) =>
    setGameStakes((s) => (i === 0 ? [v, s[1]] : [s[0], v]));
  // Collapsible forms start closed; everything else starts open.
  const [open, setOpen] = useState(!collapsible);

  const opponent = lockedOpponent ?? opponents.find((o) => o.playerId === opponentId);
  const pending = opponent?.alreadyPending ?? false;
  const oppName = opponent?.displayName ?? "Opponent";

  // Two game rows, always shown — each game has its own deck/stake + the
  // winner's lives. A 2-0/0-2 has one player winning both games; a 1-1 splits,
  // so for a draw row 1 is the reporter's won game and row 2 the opponent's. The
  // row label names that; the backend derives each game's winner from the result.
  const gameRowLabel = (i: number) =>
    result === "1-1" ? (i === 0 ? "Your win" : `${oppName}'s win`) : `Game ${i + 1}`;
  const livesWhose = (i: number) =>
    result === "2-0" ? "your lives"
    : result === "0-2" ? `${oppName}'s lives`
    : i === 0 ? "your lives" : `${oppName}'s lives`;

  const resultLabel = (r: ResultStr) =>
    opponent
      ? resultLabelBySelf(r, opponent.displayName)
      : r === "2-0" ? "You win 2-0" : r === "0-2" ? "You lose 0-2" : "1-1 draw";

  // Collapsed trigger — used in dense lists (division rows) so each row stays a
  // single line until the player chooses to report.
  if (collapsible && !open) {
    return (
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        Report{lockedOpponent ? ` vs ${lockedOpponent.displayName}` : ""}
      </Button>
    );
  }

  const resultWidth = compact ? "min-w-[150px]" : "min-w-[200px]";
  const comboWidth = compact ? "min-w-[120px]" : "min-w-[140px]";

  return (
    <form action={action} className={`flex flex-col ${compact ? "gap-2" : "gap-3"}`}>
      {/* Radix Select values → server-action FormData. Decks/stakes are per game. */}
      <input type="hidden" name="opponentId" value={opponentId} />
      <input type="hidden" name="result" value={result} />
      <input type="hidden" name="deck1" value={gameDecks[0] === NONE ? "" : gameDecks[0]} />
      <input type="hidden" name="stake1" value={gameStakes[0] === NONE ? "" : gameStakes[0]} />
      <input type="hidden" name="deck2" value={gameDecks[1] === NONE ? "" : gameDecks[1]} />
      <input type="hidden" name="stake2" value={gameStakes[1] === NONE ? "" : gameStakes[1]} />
      {hiddenFields &&
        Object.entries(hiddenFields).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}

      <div className="flex flex-wrap items-center gap-2">
        {lockedOpponent ? (
          <span className="text-sm">
            <span className="muted text-xs">vs </span>
            <strong>{lockedOpponent.displayName}</strong>
          </span>
        ) : (
          <>
            <span className="muted text-xs">vs</span>
            <Select
              items={opponents.map((o) => ({
                value: o.playerId,
                label: o.displayName + (o.alreadyPending ? " (already pending)" : ""),
              }))}
              value={opponentId}
              onValueChange={(v) => setOpponentId(v ?? "")}
            >
              <SelectTrigger className="min-w-[220px] flex-1">
                <SelectValue placeholder="— pick an opponent —" />
              </SelectTrigger>
              <SelectContent>
                {opponents.map((o) => (
                  <SelectItem key={o.playerId} value={o.playerId}>
                    {o.displayName}
                    {o.alreadyPending ? " (already pending)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        )}

        <Select
          items={(["2-0", "1-1", "0-2"] as ResultStr[]).map((r) => ({ value: r, label: resultLabel(r) }))}
          value={result}
          onValueChange={(v) => setResult((v as ResultStr) ?? "2-0")}
        >
          <SelectTrigger className={resultWidth}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="2-0">{resultLabel("2-0")}</SelectItem>
            <SelectItem value="1-1">{resultLabel("1-1")}</SelectItem>
            <SelectItem value="0-2">{resultLabel("0-2")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Per-game detail, always shown. Each game has its own deck + stake
          (they differ per game) and the winner's leftover lives (feeds the
          standings life-differential tiebreaker). All optional. The deck/stake
          dropdowns are Radix (mirrored to hidden inputs above); the lives box is
          a native input that submits directly. */}
      <div className="flex flex-col gap-2 text-[13px]">
        <span className="muted">Per game <span className="muted">(optional — decks differ each game)</span></span>
        {[0, 1].map((i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <span className="muted text-xs w-20">{gameRowLabel(i)}</span>
            <ComboSelect
              value={gameDecks[i] ?? NONE}
              onChange={(v) => setDeckAt(i, v)}
              options={decks}
              placeholder="deck"
              width={comboWidth}
            />
            <ComboSelect
              value={gameStakes[i] ?? NONE}
              onChange={(v) => setStakeAt(i, v)}
              options={stakes}
              placeholder="stake"
              width={comboWidth}
            />
            <label className="flex items-center gap-1">
              <input
                type="number"
                name={`livesGame${i + 1}`}
                min={0}
                max={999}
                inputMode="numeric"
                placeholder="lives"
                className="w-16 rounded-md border border-border bg-background px-2 py-1 text-sm"
              />
              <span className="muted text-xs">{livesWhose(i)}</span>
            </label>
          </div>
        ))}
      </div>

      {/* Live, named confirmation of exactly what's about to be recorded.
          Skipped in compact mode — the Report button label already names it. */}
      {!compact && (
        <div className="rounded-md border border-border bg-secondary px-2.5 py-2 text-[13px]">
          {opponent ? (
            <>
              You&apos;re reporting:{" "}
              <strong className="text-foreground">{resultLabelBySelf(result, opponent.displayName)}</strong>.
              {pending && (
                <span className="text-[var(--accent)]"> Heads up — a result vs {opponent.displayName} is already pending.</span>
              )}
            </>
          ) : (
            <span className="muted">Pick an opponent to confirm what gets recorded.</span>
          )}
        </div>
      )}

      <div>
        <Button type="submit" disabled={!opponentId} size={compact ? "sm" : undefined}>
          Report{opponent ? ` — ${resultLabelBySelf(result, opponent.displayName)}` : ""}
        </Button>
      </div>
    </form>
  );
}
