// Full JSON export — every row of every model, for rebuilding data after a
// schema change or between seasons. Unlike league-export.ts (a curated,
// human-readable seasons+standings snapshot), this dumps the WHOLE database
// table-by-table so it can be re-imported (see import-full.ts) or
// transformed by hand if the schema moved.
//
// Dates serialize as ISO strings; import-full.ts revives them. JSON columns
// (game1/game2/game3, preset decks/stakes) round-trip as-is.
//
// Usage:
//   npm run export:full                       # → backups/full-export-<ts>.json
//   npm run export:full -- backups/mine.json  # explicit path

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { prisma } from "../db.js";

// Every Prisma model, camelCased as on the client. Order here is just the
// dump order; import-full.ts handles FK-safe insert order.
const MODELS = [
  "player",
  "playerMmrSnapshot",
  "easterEggVote",
  "season",
  "signupRound",
  "signup",
  "matchConfigPreset",
  "matchSession",
  "leagueConfig",
  "seasonInterest",
  "roleBinding",
  "tierTemplate",
  "tier",
  "division",
  "divisionStandings",
  "shootout",
  "divisionMember",
  "pairing",
  "leagueRulesTemplate",
  "adminAuditEvent",
] as const;

type AnyDelegate = { findMany: () => Promise<unknown[]> };
const client = prisma as unknown as Record<string, AnyDelegate>;

async function main(): Promise<void> {
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    schemaVersion: 1,
  };
  let total = 0;
  for (const model of MODELS) {
    const rows = await client[model]!.findMany();
    out[model] = rows;
    total += rows.length;
  }

  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = process.argv[2] ?? `backups/full-export-${ts}.json`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(out, null, 2), "utf-8");
  console.log(`Exported ${total} rows across ${MODELS.length} models → ${path}`);
}

await main();
