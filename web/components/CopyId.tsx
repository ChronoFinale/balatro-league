"use client";

// Small inline chip that shows a player's Discord ID and copies it on click.
// Used on admin build/placement surfaces so an admin can eyeball an ID and grab
// it for a lookup without leaving the page. Admin-only pages already ship the
// discordId to the client (it's the row key), so this exposes nothing new.
//
// It's a client component (needs onClick + clipboard), so it can live inside the
// other client components (ContinuityPreview, DraggableDivisionsEditor) where the
// server-only <DiscordId> chip can't. onPointerDown stops propagation so clicking
// it inside a draggable row never starts a drag.

import { useState } from "react";

export function CopyId({ id, style }: { id: string; style?: React.CSSProperties }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Discord ID — click to copy"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard
          ?.writeText(id)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          })
          .catch(() => {});
      }}
      style={{
        display: "inline-block",
        maxWidth: "100%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
        fontSize: 10,
        lineHeight: 1.3,
        color: copied ? "var(--success)" : "var(--muted)",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        verticalAlign: "baseline",
        ...style,
      }}
    >
      {copied ? "copied ✓" : id}
    </button>
  );
}
