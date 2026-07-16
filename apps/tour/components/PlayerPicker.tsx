// A type-to-search player picker over the whole registry -- so subbing someone in isn't
// limited to the (often empty) free-agent pool. Sets a hidden <input name> to the chosen
// player's id; the form submits that id. Client-side filter over a passed-in list (no round
// trip). Shows the top matches so a few-hundred-player list stays snappy.
"use client";
import { useMemo, useState } from "react";

const inputCls = "rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-0.5";
type P = { id: string; name: string };

export function PlayerPicker({
  name,
  players,
  placeholder = "search a player",
  excludeIds = [],
}: {
  name: string;
  players: P[];
  placeholder?: string;
  excludeIds?: string[];
}) {
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<P | null>(null);
  const [open, setOpen] = useState(false);
  const excluded = useMemo(() => new Set(excludeIds), [excludeIds]);
  const pool = useMemo(() => players.filter((p) => !excluded.has(p.id)), [players, excluded]);
  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    const base = s ? pool.filter((p) => p.name.toLowerCase().includes(s)) : pool;
    return base.slice(0, 25);
  }, [q, pool]);

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input type="hidden" name={name} value={sel?.id ?? ""} />
      <input
        value={sel ? sel.name : q}
        onChange={(e) => { setSel(null); setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className={`${inputCls} w-44`}
        autoComplete="off"
      />
      {open && !sel && matches.length > 0 && (
        <ul
          className="list-none p-0"
          style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, margin: "2px 0 0", minWidth: "100%", maxHeight: 220, overflowY: "auto", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, boxShadow: "0 6px 20px rgba(0,0,0,0.25)" }}
        >
          {matches.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onMouseDown={() => { setSel(p); setQ(p.name); setOpen(false); }}
                className="block w-full text-left"
                style={{ padding: "4px 8px", background: "transparent", border: "none", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && !sel && q.trim() && matches.length === 0 && (
        <div className="sub" style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, marginTop: 2, padding: "4px 8px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6 }}>
          no match -- add them via &quot;Add a player&quot;
        </div>
      )}
    </div>
  );
}
