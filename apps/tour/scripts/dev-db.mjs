// Local dev Postgres for the Team Tour app — a persistent embedded Postgres
// (downloaded binary, no Docker/install needed), reusing the league's approach.
// Run `npm run dev:db` in a terminal and leave it up; point DATABASE_URL at the
// printed URL (see .env.example), then `npm run db:push` to create the schema.
//
// Data persists in apps/tour/.dev-db (gitignored). Ctrl+C stops it cleanly.

import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", ".dev-db");
const PORT = 54330;
const DB = "tour_dev";

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: PORT,
  persistent: true,
  // UTF8 cluster (Windows initdb otherwise defaults to WIN1252, which can't store
  // names with Unicode control chars / emoji). C locale + UTF8 is portable.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

// initialise() only on the first run (empty data dir); createDatabase only then.
const fresh = !existsSync(join(dataDir, "PG_VERSION"));
if (fresh) await pg.initialise();
await pg.start();
if (fresh) {
  await pg.createDatabase(DB);
}

const url = `postgresql://postgres:postgres@localhost:${PORT}/${DB}`;
console.log(`\n[tour dev-db] up → ${url}`);
console.log("[tour dev-db] put that in .env as DATABASE_URL, then `npm run db:push`.");
console.log("[tour dev-db] Ctrl+C to stop.\n");

const stop = async () => {
  try {
    await pg.stop();
  } catch {
    /* best effort */
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

// Keep the process alive while the DB serves.
await new Promise(() => {});
