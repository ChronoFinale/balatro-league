// Ops-script endpoint: end a season. Runs the SAME endSeasonCore the
// admin "End season" button uses — re-ranks players via the promo/
// relegation chain, writes Player.rating + DivisionMember.finalGlobalRank,
// marks the season ended/inactive. Next season's build sorts by the new
// ratings, so this is the carry-forward that makes a multi-season run
// produce real tier movement.
//
// Auth via ADMIN_TOKEN bearer. Body: { seasonId: string }.

import { NextRequest, NextResponse } from "next/server";
import { AdminTokenError, requireAdminToken } from "@/lib/admin-token";
import { endSeasonCore } from "@/lib/end-season";

interface RequestBody {
  seasonId?: unknown;
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

  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Body must be valid JSON" }, { status: 400 });
  }
  const seasonId = typeof body.seasonId === "string" ? body.seasonId.trim() : "";
  if (!seasonId) {
    return NextResponse.json({ error: "seasonId (string) is required" }, { status: 400 });
  }

  try {
    const result = await endSeasonCore(seasonId, ctx.actor);
    if (result.status === "not-found") {
      return NextResponse.json({ error: `Season ${seasonId} not found` }, { status: 404 });
    }
    if (result.status === "already-ended") {
      return NextResponse.json({ error: `${result.seasonLabel} already ended`, ...result }, { status: 409 });
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
