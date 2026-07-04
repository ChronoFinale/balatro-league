// Bot endpoint: persist what /ppt-admin bootstrap just provisioned in the guild — pin the
// created/adopted channel ids into TourConfig and bind the static staff role ids to their tier.
// Bearer TOUR_ADMIN_TOKEN. Mirrors /api/bot/role-ids (bot -> web writeback). Idempotent.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { applyBootstrapResult } from "@/lib/services/server-bootstrap";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  let body: { channels?: { key: string; id: string }[]; roles?: { tier: "TO" | "HELPER"; discordRoleId: string }[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const result = await applyBootstrapResult({ channels: body.channels ?? [], roles: body.roles ?? [] });
  return NextResponse.json({ ok: true, ...result });
}
