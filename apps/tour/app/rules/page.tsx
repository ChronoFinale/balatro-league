import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Rules · Team Tour",
  description: "Pizza Power Team Tour — official rules",
};

// docs/ is the single source of truth; the page renders it so the markdown and the
// site can never drift. docs/ lives at the monorepo root (two levels up from apps/tour).
function loadRules(): string {
  const file = path.join(process.cwd(), "..", "..", "docs", "team-tour-rules.md");
  return fs.readFileSync(file, "utf8");
}

export default async function RulesPage() {
  let md: string;
  try {
    md = loadRules();
  } catch {
    return (
      <main>
        <h1>Rules</h1>
        <p className="sub">Rules document not found.</p>
      </main>
    );
  }

  let html = await marked.parse(md);
  // Highlight unfilled {placeholders} so the draft/TBD state is obvious to readers.
  html = html.replace(/\{([^}]+)\}/g, '<span class="tbd">{$1}</span>');

  return (
    <main>
      <article className="card prose" dangerouslySetInnerHTML={{ __html: html }} />
    </main>
  );
}
