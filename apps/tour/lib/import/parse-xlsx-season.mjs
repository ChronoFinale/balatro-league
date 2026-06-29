// Runtime readers for a season's xlsx export (the Google-Sheets download). These
// pull the data that ISN'T in the HTML "alltime" export — conference + seed
// assignments (Standings tab) and signup preferred-name → Discord @username
// (signups tab) — so the importer reads them from the uploaded file instead of
// from baked-in config. Operates on the positional cell grid from xlsx-grid.mjs.
import { loadWorkbook, tabGrid } from "./xlsx-grid.mjs";

// Standings grid → { "Pluto Conference": [[team, seed], ...], ... }. Conferences
// sit in side-by-side column blocks (merged headers span their block); each team
// cell directly follows its seed integer. Maps every team column to the nearest
// "X Conference" header at or before it. Mirrors parse-conferences.mjs but keeps
// the seed and preserves first-seen order (so the seed list is in seed order).
export function conferencesFromStandingsGrid(rows) {
  if (!rows?.length) return {};

  // First row carrying "… Conference" headers → their column positions.
  let headers = [];
  for (const r of rows) {
    const hs = r.map((c, i) => ({ c: (c ?? "").trim(), i })).filter((x) => /conference$/i.test(x.c));
    if (hs.length) {
      // Collapse merged duplicates: keep the leftmost column for each distinct name.
      const byName = new Map();
      for (const h of hs) {
        const name = h.c.trim(); // keep the full "X Conference" header as the name
        if (!byName.has(name) || h.i < byName.get(name)) byName.set(name, h.i);
      }
      headers = [...byName].map(([name, col]) => ({ name, col }));
      break;
    }
  }
  if (!headers.length) return {};

  // Teams by the column they appear in, with their seed. A team cell follows a
  // seed integer 1..30 and contains letters.
  const byCol = new Map(); // teamCol → [[team, seed], ...] (first-seen order)
  for (const r of rows) {
    for (let i = 0; i < r.length - 1; i++) {
      const seed = Number(r[i]);
      const team = (r[i + 1] ?? "").trim();
      if (
        Number.isInteger(seed) && seed >= 1 && seed <= 30 &&
        team && /[A-Za-z]/.test(team) && !/conference|^seed$|^team$/i.test(team)
      ) {
        const col = i + 1;
        if (!byCol.has(col)) byCol.set(col, []);
        const list = byCol.get(col);
        if (!list.some(([t]) => t === team)) list.push([team, seed]);
      }
    }
  }

  // Each team column → nearest conference header at or before it.
  const result = {};
  for (const [teamCol, teams] of byCol) {
    let best = null;
    for (const h of headers) if (h.col <= teamCol && (!best || h.col > best.col)) best = h;
    if (!best) continue;
    const acc = (result[best.name] ??= []);
    for (const pair of teams) if (!acc.some(([t]) => t === pair[0])) acc.push(pair);
  }
  // Sort each conference by seed.
  for (const name of Object.keys(result)) result[name].sort((a, b) => a[1] - b[1]);
  return result;
}

// Signups grid → [{ preferredName, username }]. Finds the header row carrying a
// "Discord username" column and a "Preferred name" column, then reads each data row.
export function signupsFromGrid(rows) {
  if (!rows?.length) return [];
  let userCol = -1, prefCol = -1, headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const r = rows[i].map((c) => (c ?? "").toLowerCase());
    const u = r.findIndex((c) => c.includes("discord") && c.includes("username"));
    const p = r.findIndex((c) => c.includes("preferred name"));
    if (u >= 0 && p >= 0) { userCol = u; prefCol = p; headerRow = i; break; }
  }
  if (headerRow < 0) return [];

  const out = [];
  const seen = new Set();
  for (let i = headerRow + 1; i < rows.length; i++) {
    const username = (rows[i][userCol] ?? "").trim();
    const preferredName = (rows[i][prefCol] ?? "").trim();
    if (!username || !preferredName) continue;
    const key = preferredName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ preferredName, username });
  }
  return out;
}

// Load one season xlsx → its conference + signup data (each null/empty if absent).
export async function readSeasonXlsx(path) {
  const wb = await loadWorkbook(path);
  const standings = tabGrid(wb, "Standings");
  const signups = tabGrid(wb, "signups");
  return {
    conferences: standings ? conferencesFromStandingsGrid(standings) : {},
    signups: signups ? signupsFromGrid(signups) : [],
  };
}
