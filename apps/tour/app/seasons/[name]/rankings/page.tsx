import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListOrdered } from "lucide-react";
import { prisma } from "@/lib/db";
import { listSeasonRankings, rankingPool } from "@/lib/services/rankings";
import { buildNameLinker, type Segment } from "@/lib/linkify";

export const dynamic = "force-dynamic";

function Linked({ parts }: { parts: Segment[] }) {
  return <>{parts.map((s, i) => (s.href ? <Link key={i} href={s.href}>{s.text}</Link> : <span key={i}>{s.text}</span>))}</>;
}

const fmtDate = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default async function SeasonRankings({ params }: { params: Promise<{ name: string }> }) {
  const name = decodeURIComponent((await params).name);
  const season = await prisma.tourSeason.findUnique({ where: { name }, select: { id: true } });
  if (!season) notFound();
  const [rankings, pool] = await Promise.all([listSeasonRankings(name), rankingPool(name)]);
  const linker = buildNameLinker([
    ...pool.teams.map((t) => ({ name: t.name, href: `/teams/${t.id}` })),
    ...pool.players.map((p) => ({ name: p.name, href: `/players/${p.id}` })),
  ]);

  return (
    <main>
      <p>
        <Link href={`/seasons/${encodeURIComponent(name)}`} className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> {name}</Link>
      </p>
      <h1 className="flex items-center gap-2"><ListOrdered className="size-5 text-[var(--accent)]" /> Power rankings</h1>
      <p className="sub">Team and player rankings from around the tour.</p>

      {rankings.length === 0 ? (
        <div className="card"><p className="sub">No rankings yet this season.</p></div>
      ) : (
        rankings.map((r) => {
          const base = r.kind === "TEAM" ? "/teams" : "/players";
          return (
            <div className="card" key={r.id}>
              <div className="flex flex-wrap items-baseline gap-2">
                {r.week != null && <span className="badge">Week {r.week}</span>}
                <h2 style={{ fontSize: "1.15rem", margin: 0 }}>{r.title}</h2>
              </div>
              <p className="sub" style={{ marginTop: 2 }}>
                {fmtDate(r.postedAt)}
                {r.author ? <> · by {r.authorPlayerId ? <Link href={`/players/${r.authorPlayerId}`}>{r.author}</Link> : r.author}</> : null}
              </p>
              <table style={{ marginTop: 8 }}>
                <tbody>
                  {r.entries.map((e) => (
                    <tr key={e.id}>
                      <td className="num muted" style={{ width: 32 }}>{e.position}</td>
                      <td style={{ width: 34 }}>{e.tier ? <span className="badge">{e.tier}</span> : ""}</td>
                      <td className="font-semibold">{e.targetId ? <Link href={`${base}/${e.targetId}`}>{e.name}</Link> : e.name}</td>
                      <td className="sub">{e.note ? <Linked parts={linker(e.note)} /> : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })
      )}
    </main>
  );
}
