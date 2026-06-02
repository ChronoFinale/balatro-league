// DESTRUCTIVE: nukes every gameplay row in the database. Players,
// seasons, divisions, pairings, snapshots, standings cache — all gone.
// Operator config (LeagueConfig, RoleBinding, TierTemplate,
// MatchConfigPreset, LeagueRulesTemplate) and the audit log itself
// are preserved so the league can be rebuilt without re-running
// /league bootstrap-server.
//
// Two gates BEFORE the wipe runs:
//   1. Env var ALLOW_DESTRUCTIVE_WIPE must equal "true". Production
//      deploys must never have this set; the test Railway environment
//      is the only place it should be.
//   2. Request body must include confirm: "WIPE TEST ENV". A
//      typo-resistant phrase that's impossible to send by accident.
//
// Both gates fail closed (refuses if either is missing).

import { NextRequest, NextResponse } from "next/server";
import { AdminTokenError, requireAdminToken } from "@/lib/admin-token";
import { wipeTestEnvironment } from "@/lib/wipe-test-env";

const CONFIRM_PHRASE = "WIPE TEST ENV";

interface RequestBody {
  confirm?: unknown;
}

export async function POST(req: NextRequest) {
  let ctx: ReturnType<typeof requireAdminToken>;
  try {
    ctx = requireAdminToken(req);
  } catch (err) {
    if (err instanceof AdminTokenError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }

  if (process.env.ALLOW_DESTRUCTIVE_WIPE !== "true") {
    return NextResponse.json(
      {
        error:
          "Refused: ALLOW_DESTRUCTIVE_WIPE env var is not 'true'. " +
          "This endpoint only runs in environments explicitly marked as test environments. " +
          "If you're absolutely sure, set ALLOW_DESTRUCTIVE_WIPE=true on the web service.",
      },
      { status: 403 },
    );
  }

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  if (body.confirm !== CONFIRM_PHRASE) {
    return NextResponse.json(
      {
        error:
          `Refused: missing or wrong confirmation phrase. Send { "confirm": "${CONFIRM_PHRASE}" } in the request body.`,
      },
      { status: 400 },
    );
  }

  try {
    const result = await wipeTestEnvironment(ctx.actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
