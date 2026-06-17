"use client";

import { useSyncExternalStore } from "react";
import { setTimezoneAction } from "@/app/me/actions";
import { Button } from "@/components/ui/button";

// The browser's IANA zone is a client-only value, so we read it via
// useSyncExternalStore — gives null on the server (so no hydration mismatch) and
// the real zone on the client, without a setState-in-effect. It never changes
// during a session, so subscribe is a no-op.
const subscribe = () => () => {};
function detectZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

// Opt-in timezone control on /me. We detect the browser zone (Intl — no
// geolocation permission, no location stored) and show it, but store NOTHING
// until the player presses "Share". `current` is what's already saved (null =
// not sharing). Submitting with an empty value clears it.
export function TimezoneSetting({ current }: { current: string | null }) {
  const detected = useSyncExternalStore(subscribe, detectZone, () => null);

  if (current) {
    const detectedDiffers = detected && detected !== current;
    return (
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 13 }}>
          Sharing <strong>{current}</strong>{" "}
          <span className="muted" style={{ fontSize: 12 }}>— shown to server members when scheduling.</span>
        </span>
        <form action={setTimezoneAction}>
          <input type="hidden" name="timezone" value="" />
          <Button type="submit" variant="secondary">Stop sharing</Button>
        </form>
        {detectedDiffers && (
          <form action={setTimezoneAction}>
            <input type="hidden" name="timezone" value={detected} />
            <Button type="submit" variant="secondary">↻ Update to {detected}</Button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: 13 }}>
        Detected from your browser: <strong>{detected ?? "…"}</strong>{" "}
        <span className="muted" style={{ fontSize: 12 }}>— not shared until you opt in.</span>
      </span>
      <form action={setTimezoneAction}>
        <input type="hidden" name="timezone" value={detected ?? ""} />
        <Button type="submit" disabled={!detected}>Share my timezone</Button>
      </form>
    </div>
  );
}
