// Parse the cross-season `alltime/Drafts.html` → per-season team drafts.
//
// Layout: stacked season blocks. Each block opens with a header row whose col0 is
// "Team Tour N" and col1 is "Captains/Rnds" (cols 2.. are round labels "1st"…).
// Then one row per team: col1 = captain name, cols 2.. = the players that captain
// drafted, in round order (1st pick, 2nd pick, …). The captain is NOT in the picks
// — they're the team's seed-1 by definition.

import { parseSheet } from "./sheet.mjs";

export function parseDrafts(path) {
  const rows = parseSheet(path);
  const seasons = [];
  let cur = null;

  for (const r of rows) {
    const c0 = (r[0] || "").trim();
    const m = /^Team Tour\s+(\d+)/i.exec(c0);
    if (m) {
      cur = { season: Number(m[1]), teams: [] };
      seasons.push(cur);
      continue;
    }
    if (!cur) continue;
    const captain = (r[1] || "").trim();
    if (!captain || captain === "Captains/Rnds") continue;
    const picks = r.slice(2).map((x) => (x || "").trim()).filter(Boolean);
    if (picks.length === 0) continue;
    cur.teams.push({ captain, picks });
  }

  return seasons;
}
