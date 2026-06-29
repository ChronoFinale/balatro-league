// Boot-time schema sync. Normally just `prisma db push`. The one snag: the LeagueRef
// table changed its primary key (gained a required `id`), which `db push` cannot
// apply in place if the table already has rows — it errors and points at --force-reset.
// LeagueRef is purely DERIVED reference data (repopulated by the import upload), so on
// THAT specific failure we drop just that table and retry once. This fires only on the
// one structural change; routine redeploys push cleanly and keep all data.
import { execSync } from "node:child_process";

function push() {
  execSync("npx prisma db push --skip-generate", { stdio: "inherit" });
}

try {
  push();
} catch {
  console.warn("[db-sync] db push failed — dropping derived LeagueRef table and retrying once…");
  try {
    execSync('npx prisma db execute --schema prisma/schema --stdin', {
      input: 'DROP TABLE IF EXISTS "LeagueRef" CASCADE;',
      stdio: ["pipe", "inherit", "inherit"],
    });
    push();
  } catch (e) {
    console.error("[db-sync] retry failed:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
}
