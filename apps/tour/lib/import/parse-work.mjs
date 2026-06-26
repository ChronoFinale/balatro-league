// Parse a root "Work" sheet's block 1 (per-matchup team results). Columns:
//   [1]=Week [2]=T1 [3]=T1 sets [4]=T2 sets [5]=T2 [6]=T1 matches [7]=T2 matches
//   [8]=T1 games [9]=T2 games
// One row per team-vs-team matchup in a week. (Used for conference seasons whose
// only clean results source is Work, not a Game Log.)

import { parseSheet } from "./sheet.mjs";

export function parseWorkMatchups(sheetPath) {
  const rows = parseSheet(sheetPath);
  const out = [];
  for (const r of rows) {
    const week = Number(r[1]);
    const teamA = (r[2] ?? "").trim();
    const teamB = (r[5] ?? "").trim();
    const setsA = Number(r[3]);
    const setsB = Number(r[4]);
    const gamesA = Number(r[8]);
    const gamesB = Number(r[9]);
    if (!Number.isInteger(week) || week < 1 || week > 30) continue;
    if (!teamA || !teamB || !/[A-Za-z]/.test(teamA) || !/[A-Za-z]/.test(teamB)) continue;
    if (!Number.isFinite(setsA) || !Number.isFinite(setsB)) continue;
    out.push({
      week,
      teamA,
      teamB,
      setsA,
      setsB,
      gamesA: Number.isFinite(gamesA) ? gamesA : 0,
      gamesB: Number.isFinite(gamesB) ? gamesB : 0,
    });
  }
  return out;
}

if (process.argv[1]?.endsWith("parse-work.mjs")) {
  const m = parseWorkMatchups(process.argv[2] ?? "D:/STuffinside/Work.html");
  console.log("matchups:", m.length);
  const weeks = [...new Set(m.map((x) => x.week))].sort((a, b) => a - b);
  console.log("weeks:", weeks.join(", "));
  m.slice(0, 6).forEach((x) => console.log(`  wk${x.week}: ${x.teamA} ${x.setsA}-${x.setsB} ${x.teamB} (games ${x.gamesA}-${x.gamesB})`));
}
