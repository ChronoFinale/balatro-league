// Raw Postgres backup via pg_dump — a full SQL dump that restores the
// database exactly (schema + data) with `psql < file` or `pg_restore`.
// This is the disaster-recovery file; export-full.ts is the portable,
// schema-flexible JSON for rebuilds.
//
// Requires `pg_dump` on PATH (Postgres client tools) and DATABASE_URL set.
//
// Usage:
//   npm run backup:db                       # → backups/db-<ts>.sql
//   npm run backup:db -- backups/mine.sql   # explicit path
//
// Restore (CAREFUL — into a fresh/empty database):
//   psql "$DATABASE_URL" -f backups/db-<ts>.sql

import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

function main(): void {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is required (the Postgres connection string to dump).");
    process.exit(1);
  }
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const path = process.argv[2] ?? `backups/db-${ts}.sql`;
  mkdirSync(dirname(path), { recursive: true });

  try {
    // --no-owner/--no-privileges keep the dump portable across Postgres
    // roles (e.g. restoring into a fresh Railway DB with a different user).
    execFileSync("pg_dump", [url, "--no-owner", "--no-privileges", "-f", path], {
      stdio: "inherit",
    });
  } catch (err) {
    console.error(
      "pg_dump failed. Make sure the Postgres client tools are installed and on PATH.\n" +
        "  macOS:  brew install libpq && brew link --force libpq\n" +
        "  Ubuntu: sudo apt-get install postgresql-client\n" +
        "  Windows: install PostgreSQL and add its bin/ to PATH",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }
  console.log(`Postgres dump written → ${path}`);
}

main();
