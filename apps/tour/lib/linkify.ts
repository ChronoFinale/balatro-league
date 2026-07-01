// Auto-link known team/player names inside free text (news posts, ranking notes). Build a
// linker once per season from its name→href entities, then split any string into segments
// (plain text or a link) for the page to render. Names match on word boundaries and
// longest-first, so "The Nine Dusketeers" wins over "Nine" and "kechrigen" isn't matched
// inside a bigger word. Runs server-side (V8 lookbehind).
export type Segment = { text: string; href?: string };

export function buildNameLinker(entities: { name: string; href: string }[]): (text: string) => Segment[] {
  const valid = entities.filter((e) => e.name.trim().length >= 2);
  if (!valid.length) return (text) => [{ text }];
  // Longest names first so the alternation prefers them at any position.
  const sorted = [...valid].sort((a, b) => b.name.length - a.name.length);
  const byLower = new Map<string, string>();
  for (const e of sorted) { const k = e.name.toLowerCase(); if (!byLower.has(k)) byLower.set(k, e.href); }
  const escaped = sorted.map((e) => e.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const re = new RegExp(`(?<![A-Za-z0-9])(${escaped.join("|")})(?![A-Za-z0-9])`, "gi");

  return (text) => {
    if (!text) return [{ text: "" }];
    const parts: Segment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    re.lastIndex = 0;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ text: text.slice(last, m.index) });
      const href = byLower.get(m[0].toLowerCase());
      parts.push(href ? { text: m[0], href } : { text: m[0] });
      last = m.index + m[0].length;
      if (re.lastIndex === m.index) re.lastIndex++; // guard against a zero-width match loop
    }
    if (last < text.length) parts.push({ text: text.slice(last) });
    return parts;
  };
}
