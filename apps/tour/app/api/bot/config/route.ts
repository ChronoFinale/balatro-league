// Bot endpoint: read/write TourConfig (channel ids, command hash). Bearer TOUR_ADMIN_TOKEN.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { allConfig, getConfig, setConfig } from "@/lib/services/config";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  const key = new URL(req.url).searchParams.get("key");
  if (key) return NextResponse.json({ key, value: await getConfig(key) });
  return NextResponse.json(await allConfig());
}

export async function POST(req: Request) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  let body: { key?: string; value?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  if (!body.key) return NextResponse.json({ error: "key required" }, { status: 400 });
  await setConfig(body.key, body.value ?? "");
  return NextResponse.json({ ok: true });
}
