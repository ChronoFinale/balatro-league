"use client";

// Team size + "sets to win" as a percentage. setsToWin is how many of the teamSize 1v1 sets a
// team must win to take a matchup; entering that raw count is fiddly, so a TO picks a percentage
// of team size and we show + submit the resulting count live. Mirrors the FormSelect idiom: the
// controlled value posts through a hidden <input name="setsToWin"> so the server action + service
// stay unchanged (they still receive an integer). Team size drives the readout, so it lives here.
import { useState } from "react";

const inputCls = "rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1";

const majority = (n: number) => Math.floor(n / 2) + 1;

// Percentage of teamSize -> a whole number of sets. Round to nearest, then clamp to a strict
// majority (so a matchup can never tie) up to the full team size (so it stays winnable). 50% of an
// odd team size lands exactly on the majority, reproducing the historical default.
function setsFromPct(pct: number, teamSize: number): number {
  const raw = Math.round((pct / 100) * teamSize);
  return Math.min(teamSize, Math.max(majority(teamSize), raw));
}

export function SetsToWinField({ teamSize: initialTeamSize, setsToWin: initialSets }: { teamSize: number; setsToWin: number }) {
  const [teamSize, setTeamSize] = useState<number>(initialTeamSize);
  const [pct, setPct] = useState<number>(Math.min(100, Math.max(50, Math.round((initialSets / initialTeamSize) * 100))));

  const size = Number.isFinite(teamSize) && teamSize > 0 ? Math.floor(teamSize) : 1;
  const sets = setsFromPct(pct, size);

  return (
    <>
      <label className="grid gap-1 text-sm">
        <span className="muted">Team size</span>
        <input
          type="number"
          name="teamSize"
          min={1}
          max={30}
          value={Number.isFinite(teamSize) ? teamSize : ""}
          onChange={(e) => setTeamSize(e.target.valueAsNumber)}
          className={inputCls}
          style={{ width: 80 }}
        />
      </label>
      <label className="grid gap-1 text-sm" style={{ minWidth: 240 }}>
        <span className="muted">
          Sets to win a match: <strong>{sets} of {size}</strong> ({pct}%)
        </span>
        <input type="range" min={50} max={100} step={5} value={pct} onChange={(e) => setPct(e.target.valueAsNumber)} />
        <span className="muted" style={{ fontSize: 12 }}>
          Win {sets} of the {size} 1v1 sets to take the match.
        </span>
      </label>
      <input type="hidden" name="setsToWin" value={sets} />
    </>
  );
}
