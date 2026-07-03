// Bot endpoint: render payload for a decided set's #results embed. Bearer TOUR_ADMIN_TOKEN.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { setAnnouncePayload } from "@/lib/services/announce";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ setId: string }> }) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const { setId } = await params;
  const payload = await setAnnouncePayload(setId);
  if (!payload) return NextResponse.json({ error: "not announceable" }, { status: 404 });
  return NextResponse.json(payload);
}
