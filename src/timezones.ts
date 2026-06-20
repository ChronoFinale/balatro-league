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

// The zones most people actually pick — surfaced first on an empty query (so the
// box isn't a wall of "Africa/Abidjan…") and used to resolve abbreviations.
const POPULAR = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Toronto", "America/Sao_Paulo", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Moscow", "Asia/Kolkata",
  "Asia/Dubai", "Asia/Singapore", "Asia/Tokyo", "Australia/Sydney", "Pacific/Auckland",
  "UTC",
];

// Friendly aliases → IANA zones, so "EST", "pacific", "uk" resolve even though the
// IANA name never literally contains them.
const ALIASES: Record<string, string[]> = {
  est: ["America/New_York"], edt: ["America/New_York"], et: ["America/New_York"], eastern: ["America/New_York"],
  cst: ["America/Chicago"], cdt: ["America/Chicago"], ct: ["America/Chicago"], central: ["America/Chicago"],
  mst: ["America/Denver"], mdt: ["America/Denver"], mt: ["America/Denver"], mountain: ["America/Denver"],
  pst: ["America/Los_Angeles"], pdt: ["America/Los_Angeles"], pt: ["America/Los_Angeles"], pacific: ["America/Los_Angeles"],
  gmt: ["UTC"], utc: ["UTC"], z: ["UTC"],
  bst: ["Europe/London"], uk: ["Europe/London"], britain: ["Europe/London"], england: ["Europe/London"],
  cet: ["Europe/Paris"], cest: ["Europe/Paris"], ist: ["Asia/Kolkata"], india: ["Asia/Kolkata"],
  aest: ["Australia/Sydney"], aedt: ["Australia/Sydney"], nzt: ["Pacific/Auckland"],
};

// Normalise an IANA zone for matching: lowercase, "_" and "/" → spaces, so
// "America/New_York" becomes "america new york" and a "new york" query hits it.
const norm = (z: string) => z.toLowerCase().replace(/[_/]+/g, " ");

// Up to `limit` zones matching the query — forgiving: matches city names with
// spaces, common abbreviations (EST/PST/…), and region words. Empty query returns
// the popular zones first.
export function searchTimezones(query: string, limit = 25): string[] {
  const q = norm(query.trim());
  const all = [...zones()];
  if (!q) {
    const seen = new Set<string>();
    return [...POPULAR.filter((z) => isValidTimezone(z)), ...all].filter((z) => !seen.has(z) && seen.add(z)).slice(0, limit);
  }
  const aliasHits = (ALIASES[q] ?? []).filter((z) => isValidTimezone(z));
  // Score: alias > city starts-with > city includes > anywhere in the path.
  const scored = all
    .map((z) => {
      const city = norm(z.split("/").pop() ?? z);
      const score = aliasHits.includes(z) ? 100 : city.startsWith(q) ? 50 : city.includes(q) ? 25 : norm(z).includes(q) ? 10 : -1;
      return { z, score };
    })
    .filter((x) => x.score >= 0)
    .sort((a, b) => b.score - a.score || a.z.localeCompare(b.z));
  const seen = new Set<string>();
  return [...aliasHits, ...scored.map((s) => s.z)].filter((z) => !seen.has(z) && seen.add(z)).slice(0, limit);
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
