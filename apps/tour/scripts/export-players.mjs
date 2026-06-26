// Export every Team Tour player to discord-map.csv for Discord-ID mapping.
// Columns: id,displayName,discordId  (discordId pre-filled with the current value,
// e.g. legacy:<name> — replace it with the real Discord ID where you know it).
// Then run `npm run relink:discord -- --apply`.
//
// AUTO-FILL: if a league-players.csv (displayName,discordId — produced by the
// league's scripts/export-league-players.mjs) sits in this folder, we pre-fill
// the discordId for every TT player whose name EXACTLY matches a league player
// (normalized) — since most TT players also play the league, this resolves the
// bulk for you. Near-but-not-exact matches are printed as suggestions to review
// (not auto-filled, to avoid linking the wrong person on a typo).
//
// id is first and discordId is last on each line (neither contains a comma), so a
// displayName with commas is still parsed correctly by the relink script.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import prismaPkg from "../prisma/generated/client/index.js";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();

const norm = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]/g, "");

// Levenshtein (small, for near-match suggestions only).
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  const dp = Array.from({ length: m + 1 }, (_, i) => i);
  for (let j = 1; j <= n; j++) {
    let prev = dp[0];
    dp[0] = j;
    for (let i = 1; i <= m; i++) {
      const tmp = dp[i];
      dp[i] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[i], dp[i - 1]);
      prev = tmp;
    }
  }
  return dp[m];
}

// Load the league reference, if present. Map normalized name → discordId; track
// names that collide (two league players normalize the same) so we never
// auto-fill an ambiguous one.
const leaguePath = join(process.cwd(), "league-players.csv");
const leagueByName = new Map();
const ambiguous = new Set();
const leagueList = []; // [{name, norm, discordId}] for fuzzy suggestions
if (existsSync(leaguePath)) {
  const text = readFileSync(leaguePath, "utf8").replace(/\r/g, "");
  const rows = text.split("\n").filter(Boolean);
  rows.shift(); // header
  for (const line of rows) {
    const last = line.lastIndexOf(",");
    if (last < 0) continue;
    const name = line.slice(0, last);
    const discordId = line.slice(last + 1).trim();
    if (!discordId) continue;
    const key = norm(name);
    if (!key) continue;
    if (leagueByName.has(key) && leagueByName.get(key) !== discordId) ambiguous.add(key);
    leagueByName.set(key, discordId);
    leagueList.push({ name, norm: key, discordId });
  }
  console.log(`[export] loaded ${leagueByName.size} league names from league-players.csv`);
} else {
  console.log(`[export] no league-players.csv found — exporting without auto-fill (run scripts/export-league-players.mjs in the league, drop the CSV here).`);
}

const players = await prisma.player.findMany({ select: { id: true, displayName: true, discordId: true } });
players.sort((a, b) => a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));

let autoFilled = 0;
const suggestions = [];
const out = players.map((p) => {
  let discordId = p.discordId;
  const needsId = !discordId || discordId.startsWith("legacy:");
  if (needsId && leagueByName.size) {
    const key = norm(p.displayName);
    if (leagueByName.has(key) && !ambiguous.has(key)) {
      discordId = leagueByName.get(key);
      autoFilled++;
    } else {
      // No exact match — find the closest league name to suggest.
      let best = null;
      for (const l of leagueList) {
        const d = editDistance(key, l.norm);
        if (d <= 2 && (!best || d < best.d)) best = { ...l, d };
      }
      if (best) suggestions.push(`  "${p.displayName}"  ~  "${best.name}" (${best.discordId})  [edit ${best.d}]`);
    }
  }
  return `${p.id},${p.displayName},${discordId}`;
});

const path = join(process.cwd(), "discord-map.csv");
writeFileSync(path, ["id,displayName,discordId", ...out].join("\n") + "\n");

const stillLegacy = out.filter((l) => l.split(",").pop().startsWith("legacy:")).length;
console.log(`[export] wrote ${players.length} players → ${path}`);
console.log(`[export] auto-filled ${autoFilled} from the league; ${stillLegacy} still on legacy ids (need manual mapping).`);
if (suggestions.length) {
  console.log(`\n[export] ${suggestions.length} near-match suggestion(s) to review (NOT auto-filled — verify before using):`);
  console.log(suggestions.join("\n"));
}
await prisma.$disconnect();
