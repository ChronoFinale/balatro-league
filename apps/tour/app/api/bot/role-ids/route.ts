// Bot endpoint: persist the Discord role ids the bot just provisioned for a season
// (Player + Captain roles). Bearer TOUR_ADMIN_TOKEN.
import { NextResponse } from "next/server";
import { isApiAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isApiAdmin(req))) return NextResponse.json({ error: "unauthorized" }, { status: 403 });
  let body: { season?: string; playerRoleId?: string; captainRoleId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad json" }, { status: 400 });
  }
  const season = (body.season ?? "").trim();
  if (!season) return NextResponse.json({ error: "season required" }, { status: 400 });
  const s = await prisma.tourSeason.findUnique({ where: { name: season }, select: { id: true } });
  if (!s) return NextResponse.json({ error: "no such season" }, { status: 404 });
  await prisma.tourSeason.update({
    where: { id: s.id },
    data: {
      ...(body.playerRoleId ? { playerRoleId: body.playerRoleId } : {}),
      ...(body.captainRoleId ? { captainRoleId: body.captainRoleId } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
