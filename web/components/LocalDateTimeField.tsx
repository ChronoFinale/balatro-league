"use client";

// A datetime picker that records the chosen moment as an absolute instant
// (UTC ISO) regardless of the admin's timezone. The visible <input
// type="datetime-local"> is wall-clock in the BROWSER's local timezone; on
// change we convert it to a UTC ISO string in a hidden field the server reads.
// This is what makes the resulting Discord <t:…> timestamp correct for every
// viewer — the admin just picks "6pm my time" and it Just Works.

import { useState } from "react";

export function LocalDateTimeField({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  const [iso, setIso] = useState("");
  const [local, setLocal] = useState("");

  return (
    <label style={{ fontSize: 11, display: "flex", flexDirection: "column", gap: 2 }}>
      <span className="muted">{label}</span>
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => {
          const v = e.target.value;
          setLocal(v);
          // new Date("YYYY-MM-DDTHH:mm") parses in the browser's local tz, so
          // toISOString() yields the correct absolute UTC instant.
          setIso(v ? new Date(v).toISOString() : "");
        }}
      />
      <input type="hidden" name={name} value={iso} />
      {iso && (
        <span className="muted" style={{ fontSize: 10 }}>
          Saved as {new Date(iso).toUTCString()}
        </span>
      )}
    </label>
  );
}
