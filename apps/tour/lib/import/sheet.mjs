// Parse a Google-Sheets HTML export into a positional cell grid. Empties are
// preserved so columns line up. Returns rows of trimmed cell strings; the leading
// frozen row-number cell (Sheets puts one per row) is dropped so cell[0] is the
// first real column.

import { readFileSync } from "node:fs";

function decode(s) {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, ">")
    .replace(/&lt;/g, "<")
    .replace(/\s+/g, " ")
    .trim();
}

/** Parse an HTML sheet export → array of rows (each an array of cell strings). */
export function parseSheet(path, { dropRowLabel = true } = {}) {
  const html = readFileSync(path, "utf8");
  const rows = [];
  const trRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let tr;
  while ((tr = trRe.exec(html))) {
    const cells = [];
    const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let td;
    while ((td = tdRe.exec(tr[1]))) cells.push(decode(td[1]));
    if (cells.length === 0) continue;
    // Sheets exports a frozen left gutter cell holding the row number; drop it so
    // cell[0] is column A. The gutter cell is purely numeric (or empty).
    if (dropRowLabel && /^\d*$/.test(cells[0])) cells.shift();
    rows.push(cells);
  }
  return rows;
}

/** Normalize a name into a stable slug for the sentinel `legacy:<slug>` id. */
export function slug(name) {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}
