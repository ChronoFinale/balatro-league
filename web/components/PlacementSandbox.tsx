"use client";

// Dry-run placement sandbox. Runs the CURRENT signups through the real build
// math (planByRating) entirely in the browser, so you can twist the tier shape
// and watch where everyone would land — without writing a single row. planByRating
// is pure, so this projection is exactly what a real build would produce from the
// same inputs. Each division is a full round-robin (everyone plays everyone).

import { useMemo, useState } from "react";
import { planByRating, type TierConfig } from "@/lib/season-plan";

export interface SandboxPlayer {
  discordId: string;
  displayName: string;
  rating: number | null; // league seed (1 = strongest); null = unrated
  mmr: number | null;
}

export function PlacementSandbox({
  players,
  initialTiers,
  initialTargetGroupSize = 5,
}: {
  players: SandboxPlayer[];
  initialTiers: TierConfig[];
  initialTargetGroupSize?: number;
}) {
  const [tiers, setTiers] = useState<TierConfig[]>(
    initialTiers.length ? initialTiers : [{ name: "Common", divisionCount: 1 }],
  );
  const [targetGroupSize, setTargetGroupSize] = useState(initialTargetGroupSize);

  const lookup = useMemo(() => new Map(players.map((p) => [p.discordId, p])), [players]);
  const ranked = useMemo(
    () => players.map((p) => ({ id: p.discordId, discordId: p.discordId, displayName: p.displayName, rating: p.rating })),
    [players],
  );

  const projection = useMemo(() => {
    const plan = planByRating(ranked, tiers, targetGroupSize);
    let totalDivs = 0;
    let placed = 0;
    const tiersOut = plan.map((pt) => {
      const divisions = pt.divisions.map((divIds, gi) => {
        totalDivs++;
        placed += divIds.length;
        return { name: `${pt.tier.name} ${gi + 1}`, size: divIds.length, members: divIds };
      });
      return { name: pt.tier.name, position: pt.position, size: divisions.reduce((s, d) => s + d.size, 0), divisions };
    });
    return { tiersOut, totalDivs, placed };
  }, [ranked, tiers, targetGroupSize]);

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
            Division size
            <input
              type="number"
              min={2}
              max={20}
              value={targetGroupSize}
              onChange={(e) => setTargetGroupSize(Math.max(2, Math.min(20, Number(e.target.value) || 5)))}
              style={{ width: 56, padding: "2px 4px" }}
            />
            <span className="muted">→ {targetGroupSize - 1} games each</span>
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
          {projection.placed} players · {projection.totalDivs} divisions
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
                  <span className="muted" style={{ fontWeight: 400 }}>
                    — {div.size} players · {Math.max(0, div.size - 1)} games each
                  </span>
                </div>
                <div>
                  {div.members.map((id, idx) => {
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
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
