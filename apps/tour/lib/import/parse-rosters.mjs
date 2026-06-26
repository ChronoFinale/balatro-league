// Parse the alltime "Team Rosters" sheet → structured per-season teams + players.
// Layout (de-guttered cells):
//   team header  → cell[3] === "-"  : [season, teamName, wkW, "-", wkL, wk%, setW, "-", setL, set%]
//   player row                       : [season, name, seed1, seed2, seed3, avgSeed, captain, wkW, "-", wkL, ...]

import { join } from "node:path";
import { parseSheet } from "./sheet.mjs";

export function parseRosters(sheetsDir) {
  const rows = parseSheet(join(sheetsDir, "alltime", "Team Rosters.html"));
  const teams = [];
  let current = null;

  for (const r of rows) {
    const season = Number(r[0]);
    if (!Number.isFinite(season)) continue; // header / blank rows
    const name = (r[1] ?? "").trim();
    if (!name) continue;

    if (r[3] === "-") {
      // team header
      current = { season, name, players: [] };
      teams.push(current);
    } else if (current && current.season === season) {
      // player row
      const avgSeed = Number(r[5]);
      current.players.push({
        name,
        avgSeed: Number.isFinite(avgSeed) ? avgSeed : null,
        isCaptain: r[6] === "1",
      });
    }
  }
  return teams;
}

// Preview when run directly: node parse-rosters.mjs <sheetsDir>
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("parse-rosters.mjs")) {
  const dir = process.argv[2] ?? "D:/STuffinside";
  const teams = parseRosters(dir);
  const bySeason = new Map();
  for (const t of teams) bySeason.set(t.season, (bySeason.get(t.season) ?? 0) + 1);
  console.log("seasons:", [...bySeason.keys()].sort((a, b) => a - b));
  for (const [s, n] of [...bySeason].sort((a, b) => a[0] - b[0])) console.log(`  season ${s}: ${n} teams`);
  console.log("total teams:", teams.length);
  console.log("total player-rows:", teams.reduce((a, t) => a + t.players.length, 0));
  console.log("captains found:", teams.reduce((a, t) => a + t.players.filter((p) => p.isCaptain).length, 0));
  const sample = teams[0];
  console.log("\nsample team:", sample.season, sample.name);
  sample.players.forEach((p) => console.log(`   ${p.isCaptain ? "(C) " : "    "}${p.name}  avg=${p.avgSeed}`));
}
