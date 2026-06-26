// Parse the alltime "Hall of Fame" sheet → each season's champion playoff run.
// The bracket cells are scattered (visual layout): a "Quarters"/"Semis"/"Finals"
// label is followed by [champion, championScore, opponentScore, opponent].

import { join } from "node:path";
import { parseSheet } from "./sheet.mjs";

const ROUND = { Quarters: "QUARTERFINAL", Semis: "SEMIFINAL", Finals: "FINAL" };
const ORDER = { QUARTERFINAL: 0, SEMIFINAL: 1, FINAL: 2 };

export function parseHallOfFame(sheetsDir) {
  const rows = parseSheet(join(sheetsDir, "alltime", "Hall of Fame.html"));
  const champOrder = [];
  const byChamp = new Map(); // champ -> Map(round -> {round, champScore, oppScore, opp})

  for (const r of rows) {
    for (let i = 0; i < r.length; i++) {
      const round = ROUND[r[i]];
      if (!round) continue;
      const champ = (r[i + 1] ?? "").trim();
      const champScore = Number(r[i + 2]);
      const oppScore = Number(r[i + 3]);
      const opp = (r[i + 4] ?? "").trim();
      if (!champ || !opp || !Number.isFinite(champScore) || !Number.isFinite(oppScore)) continue;
      if (!byChamp.has(champ)) {
        byChamp.set(champ, new Map());
        champOrder.push(champ);
      }
      const m = byChamp.get(champ);
      if (!m.has(round)) m.set(round, { round, champScore, oppScore, opp });
    }
  }

  // Champions appear in season order → season index 1..N.
  return champOrder.map((champion, idx) => ({
    season: idx + 1,
    champion,
    rounds: [...byChamp.get(champion).values()].sort((a, b) => ORDER[a.round] - ORDER[b.round]),
  }));
}

if (process.argv[1]?.endsWith("parse-hof.mjs")) {
  for (const c of parseHallOfFame(process.argv[2] ?? "D:/STuffinside")) {
    console.log(`\nSeason ${c.season} — 🏆 ${c.champion}`);
    for (const r of c.rounds) console.log(`  ${r.round.padEnd(13)} ${c.champion} ${r.champScore}-${r.oppScore} ${r.opp}`);
  }
}
