// Thin CLI wrapper over the import SERVICE (logic lives in lib/services/import.ts,
// not here). For convenience only — the canonical trigger is the admin UI / API.
//   npm run import          → alltime (S1–3)
//   npm run import -- tt4    → Team Tour 4 conference season
import { importHistorical, importConferenceSeason } from "../lib/services/import";

const which = process.argv[2];
(which === "tt4" || which === "tt10" ? importConferenceSeason() : importHistorical())
  .then((r) => {
    console.log(JSON.stringify(r, null, 2));
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
