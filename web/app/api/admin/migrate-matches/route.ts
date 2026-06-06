// Ops-script endpoint: EXPAND-phase backfill of the legacy Pairing +
// Shootout + MatchSession JSON into the unified Match / Game / Ban tables.
// Idempotent + re-runnable — run it, check the counts, run it again. Reads
// legacy tables, writes new ones; nothing legacy is modified. Safe with
// matches in flight. Auth via ADMIN_TOKEN bearer. Body: {} (none).

import { NextRequest, NextResponse } from "next/server";
import { AdminTokenError, requireAdminToken } from "@/lib/admin-token";
import { backfillMatches } from "@/lib/migrate-matches";

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

  try {
    const result = await backfillMatches(ctx.actor);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
