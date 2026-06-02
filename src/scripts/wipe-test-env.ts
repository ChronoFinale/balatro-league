// DESTRUCTIVE: wipes every gameplay row in the target environment's
// database. Hits POST /api/admin/wipe-test-data which checks
// ALLOW_DESTRUCTIVE_WIPE=true on the web service before doing anything,
// so this script is a footgun-resistant nuke for the test environment.
//
// Auth: ADMIN_TOKEN env var (must match the web service's value).
// Defaults to local dev URL; override with --url or WEB_URL env.
//
// Usage:
//   ADMIN_TOKEN=xxx WEB_URL=https://balatro-league-test... \
//     npm run wipe:test-env -- --i-know-what-im-doing
//
// The --i-know-what-im-doing flag is a third client-side gate on top
// of the server's env + confirmation checks. Without it the script
// prints the warning and exits without calling the endpoint.

interface Args {
  webUrl: string;
  confirmed: boolean;
}

function parseArgs(): Args {
  const argv = process.argv.slice(2);
  const get = (flag: string, def: string | null): string | null => {
    const idx = argv.indexOf(flag);
    if (idx === -1 || idx === argv.length - 1) return def;
    return argv[idx + 1] ?? def;
  };
  const webUrl = get("--url", null) ?? process.env.WEB_URL ?? "http://localhost:3000";
  const confirmed = argv.includes("--i-know-what-im-doing");
  return { webUrl, confirmed };
}

async function main(): Promise<void> {
  const { webUrl, confirmed } = parseArgs();
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    console.error("ADMIN_TOKEN env var is required — set the same value that's on the web service");
    process.exit(1);
  }

  if (!confirmed) {
    console.error("");
    console.error("⚠  This will WIPE EVERY GAMEPLAY ROW in the target database.");
    console.error("    target = " + webUrl);
    console.error("");
    console.error("    Tables wiped: Player, Season, Tier, Division, DivisionMember,");
    console.error("                  Pairing, Shootout, MatchSession, Signup, SignupRound,");
    console.error("                  PlayerMmrSnapshot, DivisionStandings, EasterEggVote,");
    console.error("                  SeasonInterest");
    console.error("");
    console.error("    Preserved:    LeagueConfig, RoleBinding, TierTemplate,");
    console.error("                  MatchConfigPreset, LeagueRulesTemplate, AdminAuditEvent");
    console.error("");
    console.error("    Re-run with --i-know-what-im-doing to actually do it.");
    console.error("    (The web service must also have ALLOW_DESTRUCTIVE_WIPE=true set.)");
    process.exit(2);
  }

  const url = `${webUrl.replace(/\/$/, "")}/api/admin/wipe-test-data`;
  console.log(`POST ${url}`);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`,
    },
    body: JSON.stringify({ confirm: "WIPE TEST ENV" }),
  });
  const text = await res.text();
  let body: unknown;
  try { body = JSON.parse(text); } catch { body = text; }

  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, body);
    process.exit(1);
  }
  console.log("OK:", body);
}

await main();
