import "server-only";

// Configurable promotion/relegation + structure rules for placement, stored in
// LeagueConfig as one JSON blob. Defaults reproduce the hardcoded behaviour, so
// an unset config behaves exactly as before. The count-based swap threshold (8)
// stays hardcoded by design.

import { prisma } from "@/lib/prisma";

export interface PlacementRules {
  topFixedSize: number; // Legendary's hard cap (0 = no cap)
  roundRobinTopDivisions: number; // how many top divisions play a full round-robin
  tightenTopTiers: boolean; // Rare 1↔2 and Rare 2↔3 use 1-up/2-down (else symmetric)
}

export const DEFAULT_PLACEMENT_RULES: PlacementRules = {
  topFixedSize: 6,
  roundRobinTopDivisions: 2,
  tightenTopTiers: true,
};

const KEY = "placement_rules";

export async function getPlacementRules(): Promise<PlacementRules> {
  const row = await prisma.leagueConfig.findUnique({ where: { key: KEY }, select: { value: true } });
  if (!row?.value) return DEFAULT_PLACEMENT_RULES;
  try {
    const p = JSON.parse(row.value) as Partial<PlacementRules>;
    return {
      topFixedSize: Number.isFinite(p.topFixedSize) ? Math.max(0, Math.floor(p.topFixedSize as number)) : DEFAULT_PLACEMENT_RULES.topFixedSize,
      roundRobinTopDivisions: Number.isFinite(p.roundRobinTopDivisions) ? Math.max(0, Math.floor(p.roundRobinTopDivisions as number)) : DEFAULT_PLACEMENT_RULES.roundRobinTopDivisions,
      tightenTopTiers: typeof p.tightenTopTiers === "boolean" ? p.tightenTopTiers : DEFAULT_PLACEMENT_RULES.tightenTopTiers,
    };
  } catch {
    return DEFAULT_PLACEMENT_RULES;
  }
}

export async function setPlacementRules(rules: PlacementRules, updatedBy: string): Promise<void> {
  const value = JSON.stringify(rules);
  await prisma.leagueConfig.upsert({
    where: { key: KEY },
    create: { key: KEY, value, updatedBy },
    update: { value, updatedBy },
  });
}
