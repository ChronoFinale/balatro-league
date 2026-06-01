// League rules template manager. Each LeagueRulesTemplate row bundles
// scoring + ban policy + timeouts. Exactly one template is the default
// (used when a season doesn't specify); admins can also create alternates
// (e.g. "Casual Rules") and apply them per-season from the season page.

import { requireAdmin } from "@/lib/admin";
import { DEFAULTS } from "@/lib/league-settings";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/AdminNav";
import { SiteNav } from "@/components/SiteNav";
import {
  deleteRulesTemplate,
  saveRulesTemplate,
  setDefaultRulesTemplate,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { ok, err } = await searchParams;
  const templates = await prisma.leagueRulesTemplate.findMany({
    include: { _count: { select: { seasons: true } } },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  return (
    <>
      <SiteNav activePath="" />
      <AdminNav activePath="/admin/settings" />
      <main>
        <h2>League rules templates</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Each template bundles scoring, ban policy, and timeouts. The ★ default template
          is used by any season that hasn't picked a specific one — and is what /admin/settings
          edits "for everyone." Seasons can opt into an alternate template from their detail page.
        </p>

        {ok && (
          <div className="card" style={{ borderColor: "#2ecc71", color: "#2ecc71" }}>
            ✓ Saved. Affected standings recomputed.
          </div>
        )}
        {err && (
          <div className="card" style={{ borderColor: "#e74c3c", color: "#e74c3c" }}>
            {err}
          </div>
        )}

        {templates.length === 0 && (
          <div className="card muted">
            No rules templates yet. Create one below — the very first you create should be
            marked as default afterwards.
          </div>
        )}

        {templates.map((t) => (
          <details key={t.id} className="card" open={t.isDefault}>
            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              {t.isDefault && (
                <span className="pill" style={{ background: "rgba(241,196,15,0.2)", color: "#f1c40f" }}>
                  ★ DEFAULT
                </span>
              )}
              <strong style={{ fontSize: 16 }}>{t.name}</strong>
              <span className="muted" style={{ fontSize: 11 }}>
                {t.pointsFor20Win}/{t.pointsFor11Draw}/{t.pointsForLoss} pts · {t.firstPlayerBans}+{t.secondPlayerBans} bans from {t.matchPoolSize} · {t._count.seasons} season(s)
              </span>
            </summary>

            <form action={saveRulesTemplate} style={{ marginTop: 12 }}>
              <input type="hidden" name="id" value={t.id} />
              <label style={{ display: "block", marginBottom: 12 }}>
                Name
                <input name="name" defaultValue={t.name} required style={{ width: "100%", maxWidth: 320 }} />
              </label>

              <Section title="Scoring">
                <Field name="pointsFor20Win" label="Points for a 2-0 win" value={t.pointsFor20Win} fallback={DEFAULTS.scoring.pointsFor20Win} />
                <Field name="pointsFor11Draw" label="Points for a 1-1 draw" value={t.pointsFor11Draw} fallback={DEFAULTS.scoring.pointsFor11Draw} />
                <Field name="pointsForLoss" label="Points for a 0-2 loss" value={t.pointsForLoss} fallback={DEFAULTS.scoring.pointsForLoss} />
              </Section>

              <Section title="Match ban / pick">
                <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
                  Flow: first bans 1 → second bans <em>SecondPlayerBans</em> → first bans (FirstPlayerBans − 1) → second picks from the remainder.
                  Constraint: PoolSize − FirstPlayerBans − SecondPlayerBans ≥ 1.
                </p>
                <Field name="firstPlayerBans" label="First player total bans" value={t.firstPlayerBans} fallback={DEFAULTS.matchPolicy.firstPlayerBans} />
                <Field name="secondPlayerBans" label="Second player total bans" value={t.secondPlayerBans} fallback={DEFAULTS.matchPolicy.secondPlayerBans} />
                <Field name="matchPoolSize" label="Combo pool size" value={t.matchPoolSize} fallback={DEFAULTS.matchPolicy.poolSize} />
              </Section>

              <Section title="Timeouts">
                <Field name="matchInviteExpiryMinutes" label="Match invite expiry (minutes)" value={t.matchInviteExpiryMinutes} fallback={DEFAULTS.matchInviteExpiryMinutes} />
                <Field name="reportAutoConfirmSeconds" label="Report auto-confirm grace (seconds)" value={t.reportAutoConfirmSeconds} fallback={DEFAULTS.reportAutoConfirmSeconds} />
              </Section>

              <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                <button type="submit">Save changes</button>
              </div>
            </form>

            {/* Default + Delete actions live OUTSIDE the save form so
                each is a separate POST. */}
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              {!t.isDefault && (
                <form action={setDefaultRulesTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="secondary">★ Make default</button>
                </form>
              )}
              {!t.isDefault && (
                <form action={deleteRulesTemplate}>
                  <input type="hidden" name="id" value={t.id} />
                  <button type="submit" className="danger">Delete</button>
                </form>
              )}
              {t.isDefault && (
                <span className="muted" style={{ fontSize: 11, alignSelf: "center" }}>
                  Default template can't be deleted — make another default first.
                </span>
              )}
            </div>
          </details>
        ))}

        <details className="card">
          <summary style={{ cursor: "pointer" }}><strong>+ Create new template</strong></summary>
          <form action={saveRulesTemplate} style={{ marginTop: 12 }}>
            <label style={{ display: "block", marginBottom: 12 }}>
              Name
              <input name="name" placeholder="e.g. Casual Rules" required style={{ width: "100%", maxWidth: 320 }} />
            </label>

            <Section title="Scoring">
              <Field name="pointsFor20Win" label="Points for a 2-0 win" value={DEFAULTS.scoring.pointsFor20Win} fallback={DEFAULTS.scoring.pointsFor20Win} />
              <Field name="pointsFor11Draw" label="Points for a 1-1 draw" value={DEFAULTS.scoring.pointsFor11Draw} fallback={DEFAULTS.scoring.pointsFor11Draw} />
              <Field name="pointsForLoss" label="Points for a 0-2 loss" value={DEFAULTS.scoring.pointsForLoss} fallback={DEFAULTS.scoring.pointsForLoss} />
            </Section>

            <Section title="Match ban / pick">
              <Field name="firstPlayerBans" label="First player total bans" value={DEFAULTS.matchPolicy.firstPlayerBans} fallback={DEFAULTS.matchPolicy.firstPlayerBans} />
              <Field name="secondPlayerBans" label="Second player total bans" value={DEFAULTS.matchPolicy.secondPlayerBans} fallback={DEFAULTS.matchPolicy.secondPlayerBans} />
              <Field name="matchPoolSize" label="Combo pool size" value={DEFAULTS.matchPolicy.poolSize} fallback={DEFAULTS.matchPolicy.poolSize} />
            </Section>

            <Section title="Timeouts">
              <Field name="matchInviteExpiryMinutes" label="Match invite expiry (minutes)" value={DEFAULTS.matchInviteExpiryMinutes} fallback={DEFAULTS.matchInviteExpiryMinutes} />
              <Field name="reportAutoConfirmSeconds" label="Report auto-confirm grace (seconds)" value={DEFAULTS.reportAutoConfirmSeconds} fallback={DEFAULTS.reportAutoConfirmSeconds} />
            </Section>

            <button type="submit" style={{ marginTop: 16 }}>Create template</button>
          </form>
        </details>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 12, padding: 12, border: "1px solid var(--border)", borderRadius: 6 }}>
      <strong style={{ fontSize: 14 }}>{title}</strong>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 120px", gap: 6, alignItems: "center" }}>
        {children}
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  fallback,
}: {
  name: string;
  label: string;
  value: number;
  fallback: number;
}) {
  return (
    <>
      <label htmlFor={name}>
        {label}
        {value !== fallback && (
          <span className="muted" style={{ fontSize: 11, marginLeft: 8 }}>
            (default {fallback})
          </span>
        )}
      </label>
      <input
        id={name}
        name={name}
        type="number"
        defaultValue={value}
        min={0}
        required
        style={{ width: "100%" }}
      />
    </>
  );
}
