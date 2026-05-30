import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SiteNav } from "@/components/SiteNav";
import { AdminNav } from "@/components/AdminNav";
import { addDeck, addStake, removeDeck, removeStake, seedDefaults } from "./actions";

export const dynamic = "force-dynamic";

export default async function MatchConfigPage() {
  await requireAdmin();
  const [decks, stakes] = await Promise.all([
    prisma.allowedDeck.findMany({ orderBy: { name: "asc" } }),
    prisma.allowedStake.findMany({ orderBy: { name: "asc" } }),
  ]);

  const totalCombos = decks.length * stakes.length;

  return (
    <>
      <SiteNav activePath="/admin" />
      <AdminNav activePath="/admin/match-config" />
      <main>
        <h2>Match config</h2>
        <p className="muted">
          Decks and stakes available to <code>/start-match</code>. Each match samples 9
          unique (deck × stake) combos from the cartesian product —
          <strong> {decks.length} × {stakes.length} = {totalCombos} possible combos</strong>.
          {totalCombos < 9 && <span style={{ color: "#e74c3c" }}> ⚠ need at least 9 combos for a normal match.</span>}
        </p>

        {decks.length === 0 && stakes.length === 0 && (
          <div className="card">
            <strong>Empty whitelist</strong>
            <p className="muted">No decks or stakes configured. Seed with Balatro defaults to get started.</p>
            <form action={seedDefaults}>
              <button type="submit">Seed defaults (15 decks, 8 stakes)</button>
            </form>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card">
            <strong>Decks ({decks.length})</strong>
            <form action={addDeck} style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input type="text" name="name" placeholder="e.g. Red" required style={{ flex: 1 }} />
              <button type="submit">Add</button>
            </form>
            <ul style={{ marginTop: 12, padding: 0, listStyle: "none" }}>
              {decks.map((d) => (
                <li key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{d.name}</span>
                  <form action={removeDeck}>
                    <input type="hidden" name="id" value={d.id} />
                    <button type="submit" className="muted" style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer" }}>
                      remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <strong>Stakes ({stakes.length})</strong>
            <form action={addStake} style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <input type="text" name="name" placeholder="e.g. White" required style={{ flex: 1 }} />
              <button type="submit">Add</button>
            </form>
            <ul style={{ marginTop: 12, padding: 0, listStyle: "none" }}>
              {stakes.map((s) => (
                <li key={s.id} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{s.name}</span>
                  <form action={removeStake}>
                    <input type="hidden" name="id" value={s.id} />
                    <button type="submit" className="muted" style={{ background: "none", border: "none", color: "#e74c3c", cursor: "pointer" }}>
                      remove
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </main>
    </>
  );
}
