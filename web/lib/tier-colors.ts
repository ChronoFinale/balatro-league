// Position-based palette for tier pills. Cycles through the legendary/rare/uncommon/common
// colors so custom tier names beyond the default 4 still get sensible colors.

const PALETTE = [
  { bg: "rgba(241, 196, 15, 0.2)", fg: "#f1c40f" },   // gold
  { bg: "rgba(155, 89, 182, 0.2)", fg: "#c79be1" },   // purple
  { bg: "rgba(52, 152, 219, 0.2)", fg: "#76c7ff" },   // blue
  { bg: "rgba(149, 165, 166, 0.2)", fg: "#c0c8cb" },  // grey
] as const;

export function tierColors(position: number): { bg: string; fg: string } {
  const idx = (position - 1) % PALETTE.length;
  return PALETTE[idx]!;
}
