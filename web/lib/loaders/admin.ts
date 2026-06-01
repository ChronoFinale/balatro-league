// Admin-side loaders. Each function backs one /admin/* page; they're
// grouped in one file because individually they're small and they
// share a domain (season + division admin data).
//
// Conventions:
//   - All admin loaders assume requireAdmin() ran in the page
//   - Return shapes are page-specific; never expose raw Prisma types
//     to the caller (so the schema can evolve without touching pages)
//   - Cached standings come from loadDivisionStandings, not inline
//     computeStandings

import { prisma } from "@/lib/prisma";

// ── /admin/disputes ──────────────────────────────────────────────────

export interface AdminDisputeRow {
  pairingId: string;
  divisionId: string;
  divisionName: string;
  tierName: string;
  playerA: { id: string; displayName: string };
  playerB: { id: string; displayName: string };
  gamesWonA: number;
  gamesWonB: number;
  disputedAt: Date | null;
  disputer: { id: string; displayName: string; discordId: string } | null;
  reporter: { id: string; displayName: string } | null;
  disputeProposedGamesWonA: number | null;
  disputeProposedGamesWonB: number | null;
  disputeReason: string | null;
  disputeThreadId: string | null;
}

export async function loadAdminDisputes(): Promise<AdminDisputeRow[]> {
  const rows = await prisma.pairing.findMany({
    where: { status: "DISPUTED", division: { season: { isActive: true } } },
    select: {
      id: true,
      divisionId: true,
      gamesWonA: true,
      gamesWonB: true,
      disputedAt: true,
      disputeProposedGamesWonA: true,
      disputeProposedGamesWonB: true,
      disputeReason: true,
      disputeThreadId: true,
      playerA: { select: { id: true, displayName: true } },
      playerB: { select: { id: true, displayName: true } },
      disputer: { select: { id: true, displayName: true, discordId: true } },
      reporter: { select: { id: true, displayName: true } },
      division: {
        select: {
          name: true,
          tier: { select: { name: true } },
        },
      },
    },
    orderBy: { disputedAt: "desc" },
  });
  return rows.map((r) => ({
    pairingId: r.id,
    divisionId: r.divisionId,
    divisionName: r.division.name,
    tierName: r.division.tier.name,
    playerA: r.playerA,
    playerB: r.playerB,
    gamesWonA: r.gamesWonA,
    gamesWonB: r.gamesWonB,
    disputedAt: r.disputedAt,
    disputer: r.disputer,
    reporter: r.reporter,
    disputeProposedGamesWonA: r.disputeProposedGamesWonA,
    disputeProposedGamesWonB: r.disputeProposedGamesWonB,
    disputeReason: r.disputeReason,
    disputeThreadId: r.disputeThreadId,
  }));
}

// ── /admin/divisions (index) ─────────────────────────────────────────

export interface AdminDivisionsTier {
  id: string;
  name: string;
  position: number;
  divisions: Array<{
    id: string;
    name: string;
    memberCount: number;
    targetSize: number;
    confirmedPairingCount: number;
    expectedPairingCount: number;
  }>;
}

export interface AdminDivisionsPageData {
  season: { id: string; name: string; targetGroupSize: number } | null;
  tiers: AdminDivisionsTier[];
}

function expectedPairings(memberCount: number): number {
  return memberCount < 2 ? 0 : (memberCount * (memberCount - 1)) / 2;
}

export async function loadAdminDivisionsIndex(): Promise<AdminDivisionsPageData> {
  const season = await prisma.season.findFirst({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      targetGroupSize: true,
      tiers: {
        orderBy: { position: "asc" },
        select: {
          id: true,
          name: true,
          position: true,
          divisions: {
            orderBy: { groupNumber: "asc" },
            select: {
              id: true,
              name: true,
              targetSize: true,
              _count: { select: { members: true } },
              pairings: { where: { status: "CONFIRMED" }, select: { id: true } },
            },
          },
        },
      },
    },
  });
  if (!season) return { season: null, tiers: [] };
  const tiers: AdminDivisionsTier[] = season.tiers.map((t) => ({
    id: t.id,
    name: t.name,
    position: t.position,
    divisions: t.divisions.map((d) => ({
      id: d.id,
      name: d.name,
      memberCount: d._count.members,
      targetSize: d.targetSize ?? season.targetGroupSize,
      confirmedPairingCount: d.pairings.length,
      expectedPairingCount: expectedPairings(d._count.members),
    })),
  }));
  return {
    season: { id: season.id, name: season.name, targetGroupSize: season.targetGroupSize },
    tiers,
  };
}
