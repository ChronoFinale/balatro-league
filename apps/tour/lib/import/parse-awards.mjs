// Parse the MVP block of `alltime/Awards.html`. The sheet stacks all 7 award types
// horizontally with drifting columns (merged-cell "->" markers shift cells right),
// so only the leftmost, stable block — Most Valuable Player — is parsed reliably
// here. The other six need a cleaned sheet before they can be trusted.
//
// MVP columns (data positions — the header labels are themselves drifted): col1 =
// season #, col3 = player, col4 = set wins, col5 = games, col7 = placement, col8 =
// team name. When col3 is a "->" merge marker, everything from the player on sits
// two columns right.

import { parseSheet } from "./sheet.mjs";

export function parseAwards(path) {
  const rows = parseSheet(path);
  const mvp = [];
  let inData = false;

  for (const r of rows) {
    // The MVP sub-header row marks the start of data rows.
    if ((r[1] || "") === "Season" && (r[3] || "") === "Player") {
      inData = true;
      continue;
    }
    if (!inData) continue;

    const season = Number(r[1]);
    if (!season) continue;

    let player = (r[3] || "").trim();
    let set = r[4];
    let games = r[5];
    let placement = r[7];
    let team = r[8];
    if (player === "->") {
      // merged-cell shift: everything from the player on is 2 columns right
      player = (r[5] || "").trim();
      set = r[6];
      games = r[7];
      placement = r[9];
      team = r[10];
    }
    if (!player || player === "->") continue;

    mvp.push({
      season,
      player,
      set: Number(set) || 0,
      games: Number(games) || 0,
      team: (team || "").trim(),
      placement: Number(placement) || null,
    });
  }

  return { mvp };
}
