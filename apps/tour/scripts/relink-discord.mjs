// Apply discord-map.csv: rewrite each player's discordId to the real ID you filled
// in. Matches by Player.id (stable), so all history stays linked.
//
//   npm run relink:discord            # dry-run (preview)
//   npm run relink:discord -- --apply # write changes
//
// Only rows whose discordId is a real id (not blank, not "legacy:*") are applied.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import prismaPkg from "../prisma/generated/client/index.js";

const { PrismaClient } = prismaPkg;
const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

const path = join(process.cwd(), "discord-map.csv");
const text = readFileSync(path, "utf8").replace(/\r/g, "");
const lines = text.split("\n").filter(Boolean);
lines.shift(); // header

// id = before first comma, discordId = after last comma, displayName = the middle.
function parse(line) {
  const first = line.indexOf(",");
  const last = line.lastIndexOf(",");
  if (first < 0 || last <= first) return null;
  return { id: line.slice(0, first), displayName: line.slice(first + 1, last), discordId: line.slice(last + 1).trim() };
}

let toApply = 0;
let applied = 0;
let skipped = 0;
const conflicts = [];

for (const line of lines) {
  const row = parse(line);
  if (!row) continue;
  if (!row.discordId || row.discordId.startsWith("legacy:")) {
    skipped++;
    continue;
  }
  toApply++;
  if (!APPLY) {
    console.log(`  would set ${row.displayName} → ${row.discordId}`);
    continue;
  }
  try {
    await prisma.player.update({ where: { id: row.id }, data: { discordId: row.discordId } });
    applied++;
  } catch (e) {
    conflicts.push(`${row.displayName} (${row.discordId}): ${e.code ?? e.message}`);
  }
}

console.log(
  `[relink] ${APPLY ? `applied ${applied}` : `${toApply} to apply (dry-run)`}; ${skipped} still legacy/blank` +
    (conflicts.length ? `; ${conflicts.length} conflicts:\n  ${conflicts.join("\n  ")}` : ""),
);
if (!APPLY && toApply) console.log("[relink] re-run with --apply to write.");
await prisma.$disconnect();
