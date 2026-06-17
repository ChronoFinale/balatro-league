// IANA timezone helpers shared by /timezone (set) and /schedule (display).
// We validate everything we store against the runtime's own IANA list so a
// junk string can never land in Player.timezone.

// All IANA zones the runtime knows (Node 18+). Built once, cached as a Set for
// O(1) validation.
let zoneSet: Set<string> | null = null;
function zones(): Set<string> {
  if (!zoneSet) zoneSet = new Set(Intl.supportedValuesOf("timeZone"));
  return zoneSet;
}

export function isValidTimezone(zone: string): boolean {
  return zones().has(zone);
}

// Up to `limit` zones matching the (case-insensitive) substring query — for the
// /timezone autocomplete. Empty query returns the first `limit` zones.
export function searchTimezones(query: string, limit = 25): string[] {
  const q = query.trim().toLowerCase();
  const all = [...zones()];
  const matches = q ? all.filter((z) => z.toLowerCase().includes(q)) : all;
  return matches.slice(0, limit);
}

// "America/New_York · 3:45 PM" — the zone label plus what o'clock it currently
// is there, so a scheduler sees both the region and the actual local time.
export function formatZone(zone: string): string {
  try {
    const time = new Date().toLocaleTimeString("en-US", {
      timeZone: zone,
      hour: "numeric",
      minute: "2-digit",
    });
    return `${zone} · ${time}`;
  } catch {
    return zone;
  }
}
