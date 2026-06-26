import Link from "next/link";
import { Trophy } from "lucide-react";
import { getAllTimeTeams } from "@/lib/team";

export const dynamic = "force-dynamic";

const pct = (w: number, l: number) => (w + l ? `${((100 * w) / (w + l)).toFixed(1)}%` : "—");

export default async function Teams() {
  const teams = await getAllTimeTeams();
  return (
    <main>
      <h1>All-Time Team Leaderboard</h1>
      <p className="sub">Every team-season, by set win %.</p>
      <div className="card">
        <table>
          <thead>
            <tr>
              <th className="rank">#</th>
              <th>Team</th>
              <th>Season</th>
              <th className="num">Sets</th>
              <th className="num">Set %</th>
              <th className="num">Games</th>
              <th className="num">Game %</th>
            </tr>
          </thead>
          <tbody>
            {teams.map((t, i) => (
              <tr key={t.teamSeasonId}>
                <td className="rank">{i + 1}</td>
                <td>
                  <Link href={`/teams/${t.teamSeasonId}`}>{t.teamName}</Link>
                  {t.isChampion && <Trophy className="ml-1 inline size-3.5 align-text-bottom text-[var(--accent)]" aria-label="Champion" />}
                </td>
                <td className="sub">{t.seasonName}</td>
                <td className="num">
                  {t.setW}–{t.setL}
                </td>
                <td className="num">{pct(t.setW, t.setL)}</td>
                <td className="num">
                  {t.gameW}–{t.gameL}
                </td>
                <td className="num">{pct(t.gameW, t.gameL)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
