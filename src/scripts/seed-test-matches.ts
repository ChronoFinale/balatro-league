// CLI wrapper around seedTestMatches (see ../seed-matches-core.ts).
// Fabricates realistic COMPLETED matches for a built season so the stats
// pages and profile traits have data. Deterministic (seeded RNG).
//
// Usage:
//   npm run seed:test-matches                 # active season
//   npm run seed:test-matches -- --season 3   # by season number
//   npm run seed:test-matches -- --reset      # clear this season's matches first
//   npm run seed:test-matches -- --play 0.8   # fraction of pairs played (default 0.8)

import { seedTestMatches } from "../seed-matches-core.js";

function parseArgs(): { seasonNumber: number | null; reset: boolean; playFraction: number | undefined } {
  const argv = process.argv.slice(2);
  const get = (flag: string): string | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1 || idx === argv.length - 1) return null;
    return argv[idx + 1] ?? null;
  };
  const seasonRaw = get("--season");
  const playRaw = get("--play");
  return {
    seasonNumber: seasonRaw != null ? parseInt(seasonRaw, 10) : null,
    reset: argv.includes("--reset"),
    playFraction: playRaw != null ? parseFloat(playRaw) : undefined,
  };
}

const { seasonNumber, reset, playFraction } = parseArgs();
try {
  const r = await seedTestMatches({ seasonNumber, reset, playFraction });
  console.log(
    `Seeded ${r.pairingsMade} matches (${r.gamesMade} games, ${r.dcGames} DC forfeits) + ${r.shootoutsMade} shootouts ` +
      `across ${r.divisionCount} divisions of ${r.seasonLabel}.`,
  );
  console.log("Standings recomputed — check /standings and /stats.");
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
