// Parse the alltime "Game Log" sheet → one record per 1v1 SET.
// Layout (de-guttered): [season, P1, P1score, P2score, P2, P1seed, P2seed, ...].

import { join } from "node:path";
import { parseSheet } from "./sheet.mjs";

export function parseGameLog(sheetsDir) {
  const rows = parseSheet(join(sheetsDir, "alltime", "Game Log.html"));
  const sets = [];
  rows.forEach((r, idx) => {
    const season = Number(r[0]);
    const p1 = (r[1] ?? "").trim();
    const p2 = (r[4] ?? "").trim();
    const p1s = Number(r[2]);
    const p2s = Number(r[3]);
    if (!Number.isFinite(season) || !p1 || !p2) return;
    if (!Number.isFinite(p1s) || !Number.isFinite(p2s)) return;
    const p1seed = Number(r[5]);
    const p2seed = Number(r[6]);
    sets.push({
      rowIdx: idx,
      season,
      p1,
      p2,
      p1s,
      p2s,
      p1seed: Number.isFinite(p1seed) ? p1seed : null,
      p2seed: Number.isFinite(p2seed) ? p2seed : null,
    });
  });
  return sets;
}

if (process.argv[1]?.endsWith("parse-gamelog.mjs")) {
  const sets = parseGameLog(process.argv[2] ?? "D:/STuffinside");
  const bySeason = new Map();
  for (const s of sets) bySeason.set(s.season, (bySeason.get(s.season) ?? 0) + 1);
  console.log("total sets:", sets.length);
  for (const [s, n] of [...bySeason].sort((a, b) => a[0] - b[0])) console.log(`  season ${s}: ${n} sets`);
  console.log("sample:", JSON.stringify(sets.slice(0, 3), null, 0));
}
