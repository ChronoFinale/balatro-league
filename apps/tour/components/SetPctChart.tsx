"use client";

import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip } from "recharts";

export type SetPctPoint = {
  season: string; // short label for the axis (e.g. "TT1")
  full: string; // full season name for the tooltip
  setPct: number; // 0–100
  record: string; // "W–L"
};

type TooltipBits = { active?: boolean; payload?: Array<{ payload: SetPctPoint }> };

function ChartTooltip({ active, payload }: TooltipBits) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "8px 10px",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>{p.full}</div>
      <div style={{ color: "var(--muted)" }}>
        {p.setPct.toFixed(1)}% · {p.record}
      </div>
    </div>
  );
}

export function SetPctChart({ data }: { data: SetPctPoint[] }) {
  // A single-season player has nothing to trend.
  if (data.length < 2) return null;

  return (
    <div className="card">
      <div className="bracket-title">Set win % by season</div>
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis
              dataKey="season"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
            />
            <YAxis
              domain={[0, 100]}
              unit="%"
              tick={{ fill: "var(--muted)", fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip cursor={{ fill: "var(--surface-2)" }} content={<ChartTooltip />} />
            <Bar dataKey="setPct" radius={[4, 4, 0, 0]} fill="var(--accent)" maxBarSize={56} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
