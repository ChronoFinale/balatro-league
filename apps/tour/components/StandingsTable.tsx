"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// One standings row. Canonical order (by the season's real tiebreakers) is the
// order rows arrive in; `rank` is captured from that order and stays fixed even
// when the viewer re-sorts a column — so sorting explores without misrepresenting
// who actually placed where.
export interface StandingRow {
  teamSeasonId: string;
  name: string;
  matchupsW: number;
  matchupsL: number;
  setsW: number;
  setsL: number;
  gamesW: number;
  gamesL: number;
}

const pctStr = (w: number, l: number) => (w + l ? `${((100 * w) / (w + l)).toFixed(1)}%` : "—");
const rate = (w: number, l: number) => (w + l ? w / (w + l) : 0);

type Key = "rank" | "name" | "matchups" | "matchPct" | "sets" | "setPct" | "games" | "gamePct";

const valueOf = (r: StandingRow & { rank: number }, k: Key): number | string => {
  switch (k) {
    case "rank": return r.rank;
    case "name": return r.name.toLowerCase();
    case "matchups": return r.matchupsW + r.matchupsL;
    case "matchPct": return rate(r.matchupsW, r.matchupsL);
    case "sets": return r.setsW + r.setsL;
    case "setPct": return rate(r.setsW, r.setsL);
    case "games": return r.gamesW + r.gamesL;
    case "gamePct": return rate(r.gamesW, r.gamesL);
  }
};

export function StandingsTable({ rows }: { rows: StandingRow[] }) {
  // Freeze canonical rank before any client sort.
  const ranked = useMemo(() => rows.map((r, i) => ({ ...r, rank: i + 1 })), [rows]);
  const [sortKey, setSortKey] = useState<Key>("rank");
  const [asc, setAsc] = useState(true);

  const sorted = useMemo(() => {
    return [...ranked].sort((a, b) => {
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return asc ? cmp : -cmp;
    });
  }, [ranked, sortKey, asc]);

  const sortBy = (k: Key) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      // rank + name read best ascending; rate/volume columns high→low.
      setAsc(k === "rank" || k === "name");
    }
  };

  const arrow = (k: Key) => (k === sortKey ? (asc ? " ▲" : " ▼") : "");
  const H = ({ k, label, num }: { k: Key; label: string; num?: boolean }) => (
    <th className={`sortable${num ? " num" : ""}`} onClick={() => sortBy(k)}>
      {label}
      {arrow(k)}
    </th>
  );

  return (
    <table>
      <thead>
        <tr>
          <th className="rank sortable" onClick={() => sortBy("rank")}>#{arrow("rank")}</th>
          <H k="name" label="Team" />
          <H k="matchups" label="Matchups" num />
          <H k="matchPct" label="M %" num />
          <H k="sets" label="Sets" num />
          <H k="setPct" label="Set %" num />
          <H k="games" label="Games" num />
          <H k="gamePct" label="Game %" num />
        </tr>
      </thead>
      <tbody>
        {sorted.map((r) => (
          <tr key={r.teamSeasonId}>
            <td className="rank">{r.rank}</td>
            <td>
              <Link href={`/teams/${r.teamSeasonId}`}>{r.name}</Link>
            </td>
            <td className="num">{r.matchupsW}–{r.matchupsL}</td>
            <td className="num">{pctStr(r.matchupsW, r.matchupsL)}</td>
            <td className="num">{r.setsW}–{r.setsL}</td>
            <td className="num">{pctStr(r.setsW, r.setsL)}</td>
            <td className="num">{r.gamesW}–{r.gamesL}</td>
            <td className="num">{pctStr(r.gamesW, r.gamesL)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
