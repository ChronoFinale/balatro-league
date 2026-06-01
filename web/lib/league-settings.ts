// Reads the league rules — scoring + ban policy + timeouts — from
// LeagueRulesTemplate. Templates replace the old per-key LeagueConfig
// rows so admin can save multiple named rule sets and pick one per
// season (e.g. "Standard" for the main league, "Casual" for a relaxed
// off-season run).
//
// Two callers:
//   getLeagueSettings()                — the default template (for
//                                        flows with no season context)
//   getLeagueSettingsForSeason(id)     — the season's specific template,
//                                        falls back to default
//
// Hardcoded DEFAULTS still exist as the floor when no template exists
// at all (fresh DB before the migration seeded one).

import type { LeagueRulesTemplate } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface ScoringConfig {
  pointsFor20Win: number;
  pointsFor11Draw: number;
  pointsForLoss: number;
}

export interface MatchPolicy {
  firstPlayerBans: number;
  secondPlayerBans: number;
  poolSize: number;
  picksFromRemaining: number;
}

export interface LeagueSettings {
  scoring: ScoringConfig;
  matchPolicy: MatchPolicy;
  matchInviteExpiryMinutes: number;
  reportAutoConfirmSeconds: number;
}

export const DEFAULTS: LeagueSettings = {
  scoring: { pointsFor20Win: 3, pointsFor11Draw: 1, pointsForLoss: 0 },
  matchPolicy: { firstPlayerBans: 4, secondPlayerBans: 3, poolSize: 9, picksFromRemaining: 2 },
  matchInviteExpiryMinutes: 5,
  reportAutoConfirmSeconds: 120,
};

const TTL_MS = 30 * 1000;
// Module-level cache survives hot-reload via globalThis (Next dev otherwise
// reinitializes it on every file change). Per-season cache is keyed by
// season id; default template is the empty-string slot.
declare global {
  // eslint-disable-next-line no-var
  var __leagueSettingsCache: Map<string, { value: LeagueSettings; expiresAt: number }> | null | undefined;
}

function cache(): Map<string, { value: LeagueSettings; expiresAt: number }> {
  if (!globalThis.__leagueSettingsCache) {
    globalThis.__leagueSettingsCache = new Map();
  }
  return globalThis.__leagueSettingsCache;
}

export async function getLeagueSettings(): Promise<LeagueSettings> {
  const key = "";
  const c = cache().get(key);
  if (c && c.expiresAt > Date.now()) return c.value;
  const template = await prisma.leagueRulesTemplate.findFirst({ where: { isDefault: true } });
  const value = templateToSettings(template);
  cache().set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function getLeagueSettingsForSeason(seasonId: string): Promise<LeagueSettings> {
  const c = cache().get(seasonId);
  if (c && c.expiresAt > Date.now()) return c.value;
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { leagueRulesTemplate: true },
  });
  // Fall back to default template when the season hasn't picked one.
  // Doing the second lookup here (vs always loading default at season
  // load) avoids the round-trip when the season already has a template.
  const template = season?.leagueRulesTemplate
    ?? await prisma.leagueRulesTemplate.findFirst({ where: { isDefault: true } });
  const value = templateToSettings(template);
  cache().set(seasonId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function invalidateLeagueSettingsCache(): void {
  globalThis.__leagueSettingsCache = null;
}

function templateToSettings(template: LeagueRulesTemplate | null | undefined): LeagueSettings {
  if (!template) return DEFAULTS;
  const remaining = template.matchPoolSize - template.firstPlayerBans - template.secondPlayerBans;
  if (remaining < 1) {
    console.warn(
      `[league-settings] template "${template.name}" has invalid policy ` +
        `(pool ${template.matchPoolSize}, first ${template.firstPlayerBans}, ` +
        `second ${template.secondPlayerBans}); falling back to hardcoded defaults`,
    );
    return DEFAULTS;
  }
  return {
    scoring: {
      pointsFor20Win: template.pointsFor20Win,
      pointsFor11Draw: template.pointsFor11Draw,
      pointsForLoss: template.pointsForLoss,
    },
    matchPolicy: {
      firstPlayerBans: template.firstPlayerBans,
      secondPlayerBans: template.secondPlayerBans,
      poolSize: template.matchPoolSize,
      picksFromRemaining: remaining,
    },
    matchInviteExpiryMinutes: template.matchInviteExpiryMinutes,
    reportAutoConfirmSeconds: template.reportAutoConfirmSeconds,
  };
}

export function pointsFromGamesWithConfig(
  gamesWonSelf: number,
  gamesWonOpponent: number,
  scoring: ScoringConfig,
): number {
  if (gamesWonSelf === 2 && gamesWonOpponent === 0) return scoring.pointsFor20Win;
  if (gamesWonSelf === 1 && gamesWonOpponent === 1) return scoring.pointsFor11Draw;
  if (gamesWonSelf === 0 && gamesWonOpponent === 2) return scoring.pointsForLoss;
  return 0;
}
