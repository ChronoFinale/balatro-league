import { NextResponse } from "next/server";
import { getSearchIndex } from "@/lib/search";

// Public read-only index for the ⌘K palette. Thin wrapper over the service.
export const dynamic = "force-dynamic";

export async function GET() {
  const index = await getSearchIndex();
  return NextResponse.json(index);
}
