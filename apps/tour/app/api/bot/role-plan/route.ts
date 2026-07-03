// Bot endpoint: compute a season's Discord role-sync plan. The bot snapshots current
// role membership in the guild and POSTs it here; the web (which owns the roster truth)
// answers with the role ids + the add/remove plan. Bearer TOUR_ADMIN_TOKEN.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { getRoleSyncPlan } from "@/lib/services/discord-roles";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  let body: { season?: string; current?: { players?: string[]; captains?: string[] } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const season = (body.season ?? "").trim();
  if (!season) return NextResponse.json({ error: "season required" }, { status: 400 });
  const plan = await getRoleSyncPlan(season, {
    players: body.current?.players ?? [],
    captains: body.current?.captains ?? [],
  });
  if (!plan) return NextResponse.json({ error: "no such season" }, { status: 404 });
  return NextResponse.json(plan);
}
