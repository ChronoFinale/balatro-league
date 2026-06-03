import Link from "next/link";
import { loadStandingsPageData, type StandingsMmrEntry } from "@/lib/loaders/standings";
import { getShowBmpMmr } from "@/lib/preferences";
import { tierColors } from "@/lib/tier-colors";
import { SiteNav } from "@/components/SiteNav";
import type { StandingRow } from "@/lib/standings";

// Pretty-print a BMP season tag like "season6" → "S6". Falls back to
// raw tag for anything that doesn't match (defensive: shouldn't happen
// but the field is technically free-form).
function formatBmpSeason(tag: string | null): string {
  if (!tag) return "—";
  const m = /^season(\d+)$/.exec(tag);
  return m ? `S${m[1]}` : tag;
}

// Render the MMR cell. When the snapshot is from the current BMP
// season, just show the number. When it's from an older season (e.g.
// player hasn't played the current BMP season but we have prior data),
// annotate inline + add a hover so the reader knows it's stale.
function renderMmrCell(entry: StandingsMmrEntry | undefined, currentBmpSeason: string | null) {
  if (!entry) return <span className="muted">—</span>;
  const isStale = currentBmpSeason != null && entry.bmpSeason !== currentBmpSeason;
  if (!isStale) {
    return <span title={`From BMP ${formatBmpSeason(entry.bmpSeason)}`}>{entry.mmr}</span>;
  }
  return (
    <span
      title={`From BMP ${formatBmpSeason(entry.bmpSeason)} — player hasn't played the current BMP season (${formatBmpSeason(currentBmpSeason)}). Their MMR may have shifted.`}
      style={{ color: "#f1c40f" }}
    >
      {entry.mmr}
      <span className="muted" style={{ fontSize: 10, marginLeft: 4 }}>
        {formatBmpSeason(entry.bmpSeason)}
      </span>
    </span>
  );
}

export const dynamic = "force-dynamic"; // Always fresh — DB writes happen out-of-band via the bot

// Tooltips so the raw W-D-L / Games cells double as rate views on hover
// without bloating the visible column count.
function standingRateTooltip(r: StandingRow): string {
  if (r.played === 0) return "No matches played yet.";
  const win = Math.round((r.wins / r.played) * 100);
  const draw = Math.round((r.draws / r.played) * 100);
  const loss = Math.round((r.losses / r.played) * 100);
  return `Win ${win}% · Draw ${draw}% · Loss ${loss}% (${r.played} matches)`;
}
function gameRateTooltip(r: StandingRow): string {
  const total = r.gamesWon + r.gamesLost;
  if (total === 0) return "No games played yet.";
  const winRate = Math.round((r.gamesWon / total) * 100);
  return `Game win rate ${winRate}% (${r.gamesWon}/${total})`;
}

export default async function StandingsPage() {
  const showBmpMmr = await getShowBmpMmr();
  const data = await loadStandingsPageData({ showBmpMmr });

  return (
    <>
      <SiteNav activePath="/standings" />
      <main>
        {!data.season ? (
          <>
            <h2>Standings</h2>
            <div className="card muted">No active season right now.</div>
          </>
        ) : (
          <>
            <h2>{data.season.name} — Standings</h2>
            {data.tiers.filter((t) => t.divisions.length > 0).map((tier) => {
              const isTopTier = tier.position === data.minTierPosition;
              const isBottomTier = tier.position === data.maxTierPosition;
              return (
                <section key={tier.id} style={{ marginTop: 24 }}>
                  <h3>{tier.name}</h3>
                  <div className="grid grid-2">
                    {tier.divisions.map((div) => {
                      const droppedIds = new Set(div.droppedMemberIds);
                      const rows = div.rows.map((r) => ({
                        ...r,
                        dropped: droppedIds.has(r.player.id),
                      }));
                      const activeCount = div.activeMemberIds.length;
                      const expectedMatches = activeCount < 2 ? 0 : (activeCount * (activeCount - 1)) / 2;
                      const playedMatches = div.playedMatches;
                      const complete = expectedMatches > 0 && playedMatches >= expectedMatches;
                      // Group rows into tie chains. A new chain starts at any
                      // row NOT flagged tiedWithPrev (the natural break point).
                      // Then mark every row whose chain straddles the promo
                      // boundary (index 0) or relegation boundary (last index)
                      // — both/all players in the chain need to play shootouts.
                      const chains: number[][] = [];
                      {
                        let current: number[] = [];
                        for (let i = 0; i < rows.length; i++) {
                          if (i === 0 || !rows[i]!.tiedWithPrev) {
                            if (current.length > 0) chains.push(current);
                            current = [i];
                          } else {
                            current.push(i);
                          }
                        }
                        if (current.length > 0) chains.push(current);
                      }
                      // Effective promote/relegate count for THIS division —
                      // clamped so we don't mark everyone in tiny divisions.
                      // Leave at least 1 row that's neither promoting nor
                      // relegating.
                      const _prc = tier.promoteRelegateCount;
                      const _maxMovers = Math.max(0, Math.floor((rows.length - 1) / 2));
                      const effective = Math.min(_prc, _maxMovers);

                      // Shootout marker is TIER-INDEPENDENT — chains crossing
                      // either boundary (promo or relegation) need resolving.
                      // For N=1 this collapses to the old "ties at rank 1" /
                      // "ties at last rank" behavior; for N>1 it catches the
                      // promo/reli edge wherever it sits.
                      const promoTieRowSet = new Set<number>();
                      const relegationTieRowSet = new Set<number>();
                      for (const chain of chains) {
                        if (chain.length < 2) continue; // not a tie chain
                        if (effective > 0) {
                          const crossesPromoEdge =
                            chain.some((i) => i < effective) && chain.some((i) => i >= effective);
                          if (crossesPromoEdge) {
                            for (const idx of chain) promoTieRowSet.add(idx);
                          }
                          const reliEdge = rows.length - effective;
                          const crossesReliEdge =
                            chain.some((i) => i < reliEdge) && chain.some((i) => i >= reliEdge);
                          if (crossesReliEdge) {
                            for (const idx of chain) relegationTieRowSet.add(idx);
                          }
                        }
                      }
                      void tierColors;
                      return (
                        <div key={div.id} className="card">
                          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                            <strong>
                              <Link href={`/divisions/${div.id}`} style={{ textDecoration: "none" }}>{div.name}</Link>
                            </strong>
                            <span
                              className="pill"
                              style={{
                                background: complete ? "rgba(46,204,113,0.15)" : "rgba(149,165,166,0.15)",
                                color: complete ? "#2ecc71" : "#95a5a6",
                                fontSize: 11,
                                marginLeft: "auto",
                              }}
                              title={complete ? "All matches played" : "Round-robin in progress"}
                            >
                              {complete ? "✅" : ""} {playedMatches}/{expectedMatches} matches
                            </span>
                          </div>
                          <div className="table-scroll" style={{ marginTop: 8 }}>
                          <table className="table-dense">
                            <thead>
                              <tr>
                                <th></th>
                                <th>Player</th>
                                <th>Pts</th>
                                <th>W-D-L</th>
                                <th title="Match win rate: % of confirmed matches won 2-0.">Match W%</th>
                                <th title="Match draw rate: % of confirmed matches that ended 1-1. Loss% = 100 - Win% - Draw%.">Match D%</th>
                                <th>Games</th>
                                {showBmpMmr && (
                                  <th title="Each player's current Ranked MMR from balatromp.com — separate from your league ranking. Click a player to see their full BMP history.">BMP MMR</th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {rows.length === 0 ? (
                                <tr>
                                  <td colSpan={showBmpMmr ? 8 : 7} className="muted">No matches played yet.</td>
                                </tr>
                              ) : (
                                rows.map((r, i) => {
                                  const medal = i < 3 ? ["🥇", "🥈", "🥉"][i] : `${i + 1}.`;
                                  const link = (
                                    <Link href={`/profile/${r.player.id}`} style={{ color: "var(--text)" }}>
                                      {r.player.displayName}
                                    </Link>
                                  );
                                  const mmr = data.mmrByPlayerId.get(r.player.id);
                                  // `effective` was computed above for the same division.
                                  const isPromoting =
                                    complete && i < effective && !isTopTier && !promoTieRowSet.has(i);
                                  const isRelegating =
                                    complete && i >= rows.length - effective && !isBottomTier && !relegationTieRowSet.has(i);
                                  const movementMarker = isPromoting ? (
                                    <span title="Promotion position" style={{ color: "#2ecc71" }}>↑</span>
                                  ) : isRelegating ? (
                                    <span title="Relegation position" style={{ color: "#e74c3c" }}>↓</span>
                                  ) : null;
                                  const shootoutNeeded =
                                    complete && (promoTieRowSet.has(i) || relegationTieRowSet.has(i));
                                  const shootoutMarker = shootoutNeeded ? (
                                    <span
                                      title="Tied for promotion/relegation — play a shootout and /report-shootout"
                                      style={{ color: "#f1c40f", marginLeft: 4 }}
                                    >
                                      ⚔
                                    </span>
                                  ) : null;
                                  return (
                                    <tr key={r.player.id}>
                                      <td>{medal}{movementMarker && <> {movementMarker}</>}{shootoutMarker}</td>
                                      <td>{r.dropped ? <s>{link}</s> : link}</td>
                                      <td><strong>{r.points}</strong></td>
                                      <td title={standingRateTooltip(r)}>{r.wins}-{r.draws}-{r.losses}</td>
                                      <td>
                                        {r.played > 0
                                          ? `${Math.round((r.wins / r.played) * 100)}%`
                                          : <span className="muted">—</span>}
                                      </td>
                                      <td>
                                        {r.played > 0
                                          ? `${Math.round((r.draws / r.played) * 100)}%`
                                          : <span className="muted">—</span>}
                                      </td>
                                      <td title={gameRateTooltip(r)}>{r.gamesWon}-{r.gamesLost}</td>
                                      {showBmpMmr && (
                                        <td>{renderMmrCell(mmr, data.bmpCurrentSeason)}</td>
                                      )}
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                          </div>
                          {div.shootouts.length > 0 && (
                            <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
                              <strong style={{ color: "#f1c40f" }}>⚔ Shootout{div.shootouts.length === 1 ? "" : "s"}:</strong>{" "}
                              {div.shootouts.map((s, i) => (
                                <span key={s.id}>
                                  {i > 0 && " · "}
                                  <strong>{s.winnerName}</strong> beat {s.loserName}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </main>
    </>
  );
}
