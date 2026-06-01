// Reads the league rules — scoring + ban policy + timeouts — from
// LeagueRulesTemplate. Templates replace the old per-key LeagueConfig
// rows for these fields. Two callers:
//   getLeagueSettings()                — the default template (no
//                                        season context: /challenge,
//                                        global standings recompute)
//   getLeagueSettingsForSeason(id)     — the season's specific template,
//                                        falls back to default
//
// Hardcoded DEFAULTS are the floor when no template exists at all.
// Match sessions stamp their policy at accept time so in-flight games
// don't break when an admin edits or swaps templates mid-season.

import type { LeagueRulesTemplate } from "@prisma/client";
import { prisma } from "./db.js";

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
// Per-season cache. Default template is stored under "" so a single
// Map covers both code paths.
const cache = new Map<string, { value: LeagueSettings; expiresAt: number }>();

export async function getLeagueSettings(): Promise<LeagueSettings> {
  const key = "";
  const c = cache.get(key);
  if (c && c.expiresAt > Date.now()) return c.value;
  const template = await prisma.leagueRulesTemplate.findFirst({ where: { isDefault: true } });
  const value = templateToSettings(template);
  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export async function getLeagueSettingsForSeason(seasonId: string): Promise<LeagueSettings> {
  const c = cache.get(seasonId);
  if (c && c.expiresAt > Date.now()) return c.value;
  const season = await prisma.season.findUnique({
    where: { id: seasonId },
    select: { leagueRulesTemplate: true },
  });
  const template = season?.leagueRulesTemplate
    ?? await prisma.leagueRulesTemplate.findFirst({ where: { isDefault: true } });
  const value = templateToSettings(template);
  cache.set(seasonId, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

export function invalidateLeagueSettingsCache(): void {
  cache.clear();
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

// Compute points from a result given a scoring config. Stateless —
// callers fetch scoring once and reuse for a batch of pairings.
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
