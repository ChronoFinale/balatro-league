"use client";

// A date + time picker: a calendar for the day and a time input for the hour,
// recorded together as a UTC ISO instant so the resulting Discord <t:…> timestamp
// is correct in every viewer's timezone. Click the button → a popover with the
// calendar + time; the hidden input the server action reads updates live.
// Reusable for any date/time field.

import { useEffect, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";
import { Button } from "@/components/ui/button";

const pad = (n: number) => String(n).padStart(2, "0");

function combine(day: Date | undefined, time: string): string {
  if (!day) return "";
  const [h, m] = time.split(":").map(Number);
  const x = new Date(day);
  x.setHours(Number.isFinite(h) ? h : 12, Number.isFinite(m) ? m : 0, 0, 0);
  return x.toISOString();
}

export function DatePickerField({
  name,
  defaultIso,
  placeholder = "Pick a date & time",
}: {
  name: string;
  defaultIso?: string | null;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("18:00");

  // Hydrate from the existing value on the client (avoids SSR/client timezone
  // mismatch — the server renders the empty default, the client fills it in).
  useEffect(() => {
    if (defaultIso) {
      const d = new Date(defaultIso);
      setDay(d);
      setTime(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
    }
  }, [defaultIso]);

  const label = day
    ? `${day.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} · ${time}`
    : placeholder;

  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input type="hidden" name={name} value={combine(day, time)} />
      <Button type="button" variant="secondary" size="sm" onClick={() => setOpen((o) => !o)}>
        📅 <span suppressHydrationWarning>{label}</span>
      </Button>
      {open && (
        <div
          style={
            {
              position: "absolute",
              zIndex: 60,
              marginTop: 4,
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              padding: 8,
              boxShadow: "0 10px 30px rgba(0,0,0,0.45)",
              color: "var(--text)",
              "--rdp-accent-color": "var(--accent-2)",
              "--rdp-accent-background-color": "color-mix(in srgb, var(--accent-2) 28%, transparent)",
              "--rdp-today-color": "var(--accent)",
            } as React.CSSProperties
          }
        >
          <DayPicker mode="single" selected={day} onSelect={setDay} captionLayout="dropdown" />
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 4px 4px", borderTop: "1px solid var(--border)", marginTop: 4 }}>
            <span className="muted" style={{ fontSize: 12 }}>Time</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              style={{ fontSize: 13, padding: "3px 6px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)" }}
            />
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)} style={{ marginLeft: "auto" }}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
