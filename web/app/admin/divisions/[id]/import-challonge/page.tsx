import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { SiteNav } from "@/components/SiteNav";
import { AdminNav } from "@/components/AdminNav";
import {
  fetchMatches,
  fetchParticipants,
  fetchTournament,
  interpretScore,
  normalizeSlug,
} from "@/lib/challonge";
import { importChallonge } from "./actions";

export const dynamic = "force-dynamic";

export default async function ImportChallongePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ slug?: string; key?: string; err?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const { slug: slugRaw, key, err } = await searchParams;

  const division = await prisma.division.findUnique({
    where: { id },
    include: { tier: true, season: true },
  });
  if (!division) notFound();

  const apiKey = key?.trim() || process.env.CHALLONGE_API_KEY || "";
  const hasKey = apiKey.length > 0;

  let preview:
    | { tournament: Awaited<ReturnType<typeof fetchTournament>>; participants: Awaited<ReturnType<typeof fetchParticipants>>; matches: Awaited<ReturnType<typeof fetchMatches>>; slug: string }
    | { error: string }
    | null = null;

  if (slugRaw && hasKey) {
    const slug = normalizeSlug(slugRaw);
    try {
      const [tournament, participants, matches] = await Promise.all([
        fetchTournament(slug, apiKey),
        fetchParticipants(slug, apiKey),
        fetchMatches(slug, apiKey),
      ]);
      preview = { tournament, participants, matches, slug };
    } catch (e: unknown) {
      preview = { error: e instanceof Error ? e.message : String(e) };
    }
  }

  return (
    <>
      <SiteNav activePath="/admin" />
      <AdminNav activePath="/admin/divisions" />
      <main>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <h2 style={{ margin: 0 }}>Import from Challonge → {division.name}</h2>
          <Link href={`/admin/divisions/${division.id}`} className="muted" style={{ marginLeft: "auto" }}>
            ← Back to division
          </Link>
        </div>
        <p className="muted">
          Pulls participants + played matches from a Challonge bracket and imports them
          into this division. Discord IDs aren't on Challonge, so you provide a name →
          Discord ID mapping (one line per player).
        </p>

        {err && (
          <div className="card" style={{ borderColor: "#e74c3c", color: "#e74c3c" }}>{err}</div>
        )}

        <div className="card">
          <strong>1. Load Challonge bracket</strong>
          <form method="get" style={{ display: "grid", gap: 8, marginTop: 8 }}>
            <label>
              Bracket URL or slug
              <input
                type="text"
                name="slug"
                defaultValue={slugRaw ?? ""}
                placeholder="https://challonge.com/mzegd4q9 or just mzegd4q9"
                required
                style={{ width: "100%" }}
              />
            </label>
            <label>
              Challonge API key {hasKey && <span className="muted" style={{ fontSize: 11 }}>(env CHALLONGE_API_KEY is set; leave blank to use it)</span>}
              <input
                type="text"
                name="key"
                defaultValue={key ?? ""}
                placeholder="API key from challonge.com → Developer API"
                style={{ width: "100%" }}
              />
            </label>
            <button type="submit">Load preview</button>
          </form>
        </div>

        {preview && "error" in preview && (
          <div className="card" style={{ borderColor: "#e74c3c", color: "#e74c3c" }}>
            <strong>Challonge fetch failed</strong>
            <pre style={{ fontSize: 11, whiteSpace: "pre-wrap", marginTop: 4 }}>{preview.error}</pre>
          </div>
        )}

        {preview && "tournament" in preview && (
          <>
            <div className="card">
              <strong>{preview.tournament.name}</strong>{" "}
              <span className="muted">
                ({preview.tournament.tournament_type} · state: {preview.tournament.state} · {preview.tournament.participants_count} participants)
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 8 }}>
                <div>
                  <strong style={{ fontSize: 13 }}>Participants ({preview.participants.length})</strong>
                  <ol style={{ marginTop: 4, paddingLeft: 20 }}>
                    {preview.participants.map((p) => (
                      <li key={p.id}>{p.name}</li>
                    ))}
                  </ol>
                </div>
                <div>
                  <strong style={{ fontSize: 13 }}>Completed matches</strong>
                  <ul style={{ marginTop: 4, paddingLeft: 20 }}>
                    {preview.matches
                      .filter((m) => m.state === "complete")
                      .map((m) => {
                        const p1 = preview.participants.find((p) => p.id === m.player1_id);
                        const p2 = preview.participants.find((p) => p.id === m.player2_id);
                        const interp = interpretScore(m.scores_csv, m.winner_id, m.player1_id);
                        const resultStr = interp.ok ? interp.result : `⚠ ${interp.reason}`;
                        return (
                          <li key={m.id}>
                            {p1?.name ?? "?"} <strong>{resultStr}</strong> {p2?.name ?? "?"}
                          </li>
                        );
                      })}
                  </ul>
                  {preview.matches.filter((m) => m.state === "complete").length === 0 && (
                    <div className="muted">No completed matches yet.</div>
                  )}
                </div>
              </div>
            </div>

            <div className="card">
              <strong>2. Map names → Discord IDs</strong>
              <p className="muted">
                One line per player: <code>ChallongeName, 123456789012345678</code> (comma or
                space separator). Names must match Challonge exactly (case-insensitive).
                Pre-filled with one line per participant — just fill in the Discord IDs.
              </p>
              <form action={importChallonge}>
                <input type="hidden" name="divisionId" value={division.id} />
                <input type="hidden" name="slug" value={preview.slug} />
                <input type="hidden" name="apiKey" value={apiKey} />
                <textarea
                  name="mapping"
                  rows={Math.max(6, preview.participants.length + 1)}
                  defaultValue={preview.participants.map((p) => `${p.name}, `).join("\n")}
                  style={{ width: "100%", fontFamily: "ui-monospace, monospace", fontSize: 12 }}
                  required
                />
                <button type="submit" style={{ marginTop: 8 }}>
                  Import {preview.participants.length} player(s) + {preview.matches.filter((m) => m.state === "complete").length} match result(s)
                </button>
              </form>
            </div>
          </>
        )}
      </main>
    </>
  );
}
