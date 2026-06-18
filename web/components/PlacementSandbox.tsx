"use client";

// Dry-run placement sandbox. Runs the CURRENT signups through the real build
// math (planByRating) + the real sub-grouping (balanceSubGroups) entirely in the
// browser, so you can twist the tier shape + group size and watch where everyone
// would land — without writing a single row. Both functions are pure, so this
// projection is exactly what a real build would produce from the same inputs.
//
// It also surfaces the "muddle": a division whose sub-groups aren't all the same
// size means some players play more games than others in the SAME standings —
// flagged so you can reshape until every division is internally fair.

import { useMemo, useState } from "react";
import { planByRating, type TierConfig } from "@/lib/season-plan";
import { balanceSubGroups, groupLetter } from "@/lib/sub-grouping";

export interface SandboxPlayer {
  discordId: string;
  displayName: string;
  rating: number | null; // league seed (1 = strongest); null = unrated
  mmr: number | null;
}

export function PlacementSandbox({
  players,
  initialTiers,
  initialSubGroupSize = 5,
}: {
  players: SandboxPlayer[];
  initialTiers: TierConfig[];
  initialSubGroupSize?: number;
}) {
  const [tiers, setTiers] = useState<TierConfig[]>(
    initialTiers.length ? initialTiers : [{ name: "Common", divisionCount: 1 }],
  );
  const [subGroupSize, setSubGroupSize] = useState(initialSubGroupSize);

  const lookup = useMemo(() => new Map(players.map((p) => [p.discordId, p])), [players]);
  const ranked = useMemo(
    () => players.map((p) => ({ id: p.discordId, discordId: p.discordId, displayName: p.displayName, rating: p.rating })),
    [players],
  );

  const projection = useMemo(() => {
    const plan = planByRating(ranked, tiers, subGroupSize);
    let totalDivs = 0;
    let totalGroups = 0;
    let unevenDivs = 0;
    let placed = 0;
    const tiersOut = plan.map((pt) => {
      const divisions = pt.divisions.map((divIds, gi) => {
        totalDivs++;
        placed += divIds.length;
        const { groups, groupCount } = balanceSubGroups(divIds, subGroupSize);
        totalGroups += groupCount;
        const members: string[][] = Array.from({ length: groupCount }, () => []);
        divIds.forEach((id, i) => {
          const g = (groups[i] ?? 1) - 1;
          if (members[g]) members[g]!.push(id);
        });
        const sizes = members.map((m) => m.length);
        const uneven = sizes.length > 1 && new Set(sizes).size > 1;
        if (uneven) unevenDivs++;
        return { name: `${pt.tier.name} ${gi + 1}`, size: divIds.length, members, sizes, uneven };
      });
      return { name: pt.tier.name, position: pt.position, size: divisions.reduce((s, d) => s + d.size, 0), divisions };
    });
    return { tiersOut, totalDivs, totalGroups, unevenDivs, placed };
  }, [ranked, tiers, subGroupSize]);

  const updateTier = (i: number, patch: Partial<TierConfig>) =>
    setTiers(tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t)));
  const addTier = () => setTiers([...tiers, { name: "New tier", divisionCount: 1 }]);
  const removeTier = (i: number) => setTiers(tiers.filter((_, idx) => idx !== i));

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Controls */}
      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <strong>Structure</strong>
          <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
            Group size
            <input
              type="number"
              min={2}
              max={20}
              value={subGroupSize}
              onChange={(e) => setSubGroupSize(Math.max(2, Math.min(20, Number(e.target.value) || 5)))}
              style={{ width: 56, padding: "2px 4px" }}
            />
            <span className="muted">→ {subGroupSize - 1} games each</span>
          </label>
        </div>

        <div style={{ marginTop: 10, display: "grid", gap: 6 }}>
          {tiers.map((t, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span className="muted" style={{ fontSize: 11, width: 16 }}>{i + 1}</span>
              <input
                type="text"
                value={t.name}
                onChange={(e) => updateTier(i, { name: e.target.value })}
                style={{ flex: "1 1 160px", padding: "2px 6px", fontSize: 13 }}
              />
              <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }} className="muted">
                divisions
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={t.divisionCount}
                  onChange={(e) => updateTier(i, { divisionCount: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                  style={{ width: 48, padding: "2px 4px", fontSize: 13 }}
                />
              </label>
              <button
                type="button"
                onClick={() => removeTier(i)}
                disabled={tiers.length <= 1}
                style={{ background: "none", border: "none", color: tiers.length <= 1 ? "#555" : "#e74c3c", cursor: tiers.length <= 1 ? "default" : "pointer", fontSize: 12 }}
              >
                remove
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addTier}
            style={{ background: "none", border: "none", color: "#76c7ff", cursor: "pointer", fontSize: 12, justifySelf: "start", padding: 0 }}
          >
            + Add tier
          </button>
        </div>

        <div className="muted" style={{ fontSize: 12, marginTop: 10, borderTop: "1px solid var(--border)", paddingTop: 8 }}>
          {projection.placed} players · {projection.totalDivs} divisions · {projection.totalGroups} groups ·{" "}
          {projection.unevenDivs === 0 ? (
            <span style={{ color: "#2ecc71" }}>every division splits evenly ✓</span>
          ) : (
            <span style={{ color: "#f1c40f" }}>⚠ {projection.unevenDivs} division{projection.unevenDivs === 1 ? "" : "s"} with uneven groups (unequal games)</span>
          )}
        </div>
        <p className="muted" style={{ fontSize: 11, margin: "6px 0 0" }}>
          Dry-run only — nothing here is saved. Division sizes are derived from how many divisions you give each tier.
        </p>
      </div>

      {/* Projection */}
      {projection.tiersOut.map((tier) => (
        <div key={tier.position}>
          <h3 style={{ margin: "4px 0 8px", display: "flex", alignItems: "baseline", gap: 10 }}>
            {tier.name}
            <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>
              {tier.size} player{tier.size === 1 ? "" : "s"} · {tier.divisions.length} division{tier.divisions.length === 1 ? "" : "s"}
            </span>
          </h3>
          <div style={{ display: "grid", gap: 10 }}>
            {tier.divisions.map((div) => (
              <div key={div.name} className="card" style={{ margin: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>
                  {div.name}{" "}
                  <span className="muted" style={{ fontWeight: 400 }}>— {div.size} players</span>
                  {div.uneven && (
                    <span style={{ color: "#f1c40f", fontWeight: 400, marginLeft: 8, fontSize: 12 }}>
                      ⚠ uneven groups ({[...new Set(div.sizes)].sort((a, b) => b - a).join("/")}) — some play more games
                    </span>
                  )}
                </div>
                <div style={{ display: "flex", gap: 10, flexWrap: "nowrap", overflowX: "auto", paddingBottom: 4 }}>
                  {div.members.map((groupIds, gi) => (
                    <div key={gi} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 8, width: 190, flex: "0 0 auto" }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 4 }}>
                        Group {groupLetter(gi + 1)}{" "}
                        <span className="muted" style={{ fontWeight: 400 }}>· {groupIds.length}p · {Math.max(0, groupIds.length - 1)} games</span>
                      </div>
                      {groupIds.map((id, idx) => {
                        const p = lookup.get(id);
                        return (
                          <div
                            key={id}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "3px 4px",
                              fontSize: 13,
                              borderTop: idx === 0 ? undefined : "1px solid rgba(255,255,255,0.06)",
                            }}
                          >
                            <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {p?.displayName ?? id}
                            </span>
                            <span
                              className="muted"
                              style={{ fontSize: 11, fontVariantNumeric: "tabular-nums", color: p?.rating == null ? "#666" : undefined }}
                              title="League seed (rating)"
                            >
                              {p?.rating == null ? "L —" : `L#${p.rating}`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
