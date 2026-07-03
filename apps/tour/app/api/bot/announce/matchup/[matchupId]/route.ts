// Bot endpoint: render payload for a decided matchup's #results banner. Bearer TOUR_ADMIN_TOKEN.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { matchupAnnouncePayload } from "@/lib/services/announce";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ matchupId: string }> }) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const { matchupId } = await params;
  const payload = await matchupAnnouncePayload(matchupId);
  if (!payload) return NextResponse.json({ error: "not announceable" }, { status: 404 });
  return NextResponse.json(payload);
}
