// Admin-tunable league rules. Each field maps to a LeagueConfig key
// read by getLeagueSettings() on both bot and web sides. Cache invalidates
// on save (web side immediately; bot side within ~30s via TTL).
//
// Standings cache stamps the scoring config snapshot, so changing
// PointsFor* prompts a full standings recompute as part of the save.

import { requireAdmin } from "@/lib/admin";
import { DEFAULTS, getLeagueSettings } from "@/lib/league-settings";
import { AdminNav } from "@/components/AdminNav";
import { SiteNav } from "@/components/SiteNav";
import { saveLeagueSettings } from "./actions";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; err?: string }>;
}) {
  await requireAdmin();
  const { ok, err } = await searchParams;
  const settings = await getLeagueSettings();

  return (
    <>
      <SiteNav activePath="" />
      <AdminNav activePath="/admin/settings" />
      <main>
        <h2>League settings</h2>
        <p className="muted" style={{ fontSize: 12 }}>
          Tunable rules. Changes take effect immediately for new matches and reports;
          in-flight matches keep the policy they were created with. Changing scoring
          triggers a full standings recompute across the active season.
        </p>

        {ok && (
          <div className="card" style={{ borderColor: "#2ecc71", color: "#2ecc71" }}>
            ✓ Settings saved. Standings recomputed.
          </div>
        )}
        {err && (
          <div className="card" style={{ borderColor: "#e74c3c", color: "#e74c3c" }}>
            {err}
          </div>
        )}

        <form action={saveLeagueSettings}>
          <Section title="Scoring">
            <Field name="PointsFor20Win" label="Points for a 2-0 win" value={settings.scoring.pointsFor20Win} fallback={DEFAULTS.scoring.pointsFor20Win} />
            <Field name="PointsFor11Draw" label="Points for a 1-1 draw" value={settings.scoring.pointsFor11Draw} fallback={DEFAULTS.scoring.pointsFor11Draw} />
            <Field name="PointsForLoss" label="Points for a 0-2 loss" value={settings.scoring.pointsForLoss} fallback={DEFAULTS.scoring.pointsForLoss} />
          </Section>

          <Section title="Match ban / pick">
            <p className="muted" style={{ fontSize: 11, marginBottom: 8 }}>
              Flow: first bans 1 → second bans <em>SecondPlayerBans</em> → first bans (FirstPlayerBans − 1) → second picks from the remainder.
              Constraint: PoolSize − FirstPlayerBans − SecondPlayerBans ≥ 1.
            </p>
            <Field name="FirstPlayerBans" label="First player total bans" value={settings.matchPolicy.firstPlayerBans} fallback={DEFAULTS.matchPolicy.firstPlayerBans} />
            <Field name="SecondPlayerBans" label="Second player total bans" value={settings.matchPolicy.secondPlayerBans} fallback={DEFAULTS.matchPolicy.secondPlayerBans} />
            <Field name="MatchPoolSize" label="Combo pool size" value={settings.matchPolicy.poolSize} fallback={DEFAULTS.matchPolicy.poolSize} />
          </Section>

          <Section title="Timeouts">
            <Field name="MatchInviteExpiryMinutes" label="Match invite expiry (minutes)" value={settings.matchInviteExpiryMinutes} fallback={DEFAULTS.matchInviteExpiryMinutes} />
            <Field name="ReportAutoConfirmSeconds" label="Report auto-confirm grace (seconds)" value={settings.reportAutoConfirmSeconds} fallback={DEFAULTS.reportAutoConfirmSeconds} />
          </Section>

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button type="submit">Save settings</button>
          </div>
        </form>
      </main>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <strong>{title}</strong>
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
