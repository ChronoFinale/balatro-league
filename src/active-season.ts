// One place for "what season are players currently looking at?" — the currently active season.
// Visibility filtering is gone (was used to hide test seasons on prod; we have a dedicated
// dev stack now), so admin and player-facing callers can share this same lookup.

import { prisma } from "./db.js";

export function activePublicSeason() {
  return prisma.season.findFirst({ where: { isActive: true } });
}
