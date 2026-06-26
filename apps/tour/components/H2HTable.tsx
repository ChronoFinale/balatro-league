"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { H2HLine } from "@/lib/stats";

const pctStr = (w: number, l: number) => (w + l ? `${((100 * w) / (w + l)).toFixed(1)}%` : "—");
const rate = (w: number, l: number) => (w + l ? w / (w + l) : 0);

type Key = "name" | "sets" | "setPct" | "games" | "gamePct";

const valueOf = (h: H2HLine, k: Key): number | string => {
  switch (k) {
    case "name": return h.name.toLowerCase();
    case "sets": return h.setW + h.setL;
    case "setPct": return rate(h.setW, h.setL);
    case "games": return h.gameW + h.gameL;
    case "gamePct": return rate(h.gameW, h.gameL);
  }
};

export function H2HTable({ rows }: { rows: H2HLine[] }) {
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<Key>("sets");
  const [asc, setAsc] = useState(false);

  const sorted = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = needle ? rows.filter((h) => h.name.toLowerCase().includes(needle)) : rows;
    return [...filtered].sort((a, b) => {
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return asc ? cmp : -cmp;
    });
  }, [rows, q, sortKey, asc]);

  const sortBy = (k: Key) => {
    if (k === sortKey) setAsc((v) => !v);
    else {
      setSortKey(k);
      setAsc(k === "name");
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
    <>
      {rows.length > 8 && (
        <input
          className="search"
          type="search"
          placeholder="Filter opponents…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      )}
      <div className="card">
        <table>
          <thead>
            <tr>
              <H k="name" label="Opponent" />
              <H k="sets" label="Sets" num />
              <H k="setPct" label="Set %" num />
              <H k="games" label="Games" num />
              <H k="gamePct" label="Game %" num />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h) => (
              <tr key={h.opponentId}>
                <td>
                  <Link href={`/players/${h.opponentId}`}>{h.name}</Link>
                </td>
                <td className="num">{h.setW}–{h.setL}</td>
                <td className="num">{pctStr(h.setW, h.setL)}</td>
                <td className="num">{h.gameW}–{h.gameL}</td>
                <td className="num">{pctStr(h.gameW, h.gameL)}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="sub">No opponents match “{q}”.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
