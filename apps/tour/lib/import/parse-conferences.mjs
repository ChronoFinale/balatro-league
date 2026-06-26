// Parse a Standings-style sheet → { conferenceName: [teamNames] }. Conferences
// sit in side-by-side column blocks; each team cell follows its seed number.
// Generic: detects every "X Conference" header and every (seed, team) pair, then
// maps each team column to its nearest conference header.

import { parseSheet } from "./sheet.mjs";

export function parseStandingsConferences(sheetPath) {
  const rows = parseSheet(sheetPath);

  // Conference headers (e.g. "Pluto Conference") and their column positions.
  let headers = [];
  for (const r of rows) {
    const hs = r.map((c, i) => ({ c: (c ?? "").trim(), i })).filter((x) => /conference$/i.test(x.c));
    if (hs.length) {
      headers = hs.map((h) => ({ name: h.c.replace(/ ?conference$/i, "").trim(), col: h.i }));
      break;
    }
  }

  // Collect teams by the column they appear in (a team cell directly follows a
  // seed integer 1..30 and contains letters).
  const byCol = new Map();
  for (const r of rows) {
    for (let i = 0; i < r.length - 1; i++) {
      const seed = Number(r[i]);
      const team = (r[i + 1] ?? "").trim();
      if (
        Number.isInteger(seed) &&
        seed >= 1 &&
        seed <= 30 &&
        team &&
        /[A-Za-z]/.test(team) &&
        !/conference|^seed$|^team$/i.test(team)
      ) {
        if (!byCol.has(i + 1)) byCol.set(i + 1, []);
        const list = byCol.get(i + 1);
        if (!list.includes(team)) list.push(team);
      }
    }
  }

  // Map each team-column to the nearest conference header at or before it.
  const result = {};
  for (const [teamCol, teams] of byCol) {
    let best = null;
    for (const h of headers) if (h.col <= teamCol && (!best || h.col > best.col)) best = h;
    const name = best ? best.name : `Conference@${teamCol}`;
    result[name] = [...new Set([...(result[name] ?? []), ...teams])];
  }
  return result;
}

if (process.argv[1]?.endsWith("parse-conferences.mjs")) {
  const path = process.argv[2] ?? "D:/STuffinside/Standings.html";
  const confs = parseStandingsConferences(path);
  for (const [name, teams] of Object.entries(confs)) {
    console.log(`\n${name} (${teams.length}):`);
    teams.forEach((t) => console.log("  " + t));
  }
}
