# Team Tour — Handoff / Current State

A start-here snapshot for the next person/agent. Pairs with: `docs/team-tour-design.md`
(deep design + decisions), `apps/tour/AGENTS.md` (conventions — **follow these**),
`apps/tour/DEPLOY.md` (Railway runbook).

> **Status in one line:** the **read-side showcase is complete and running locally**;
> the write-side is **scaffolded** (admin + signups + identity tools done; live draft
> services built but UI parked); **nothing is deployed yet** (local only).

---

## 0. Run it locally
```
cd apps/tour
npm run dev:db          # embedded Postgres on :54330, persisted in apps/tour/.dev-db
npx next dev -p 4000    # the site
# open http://localhost:4000
```
- `.env` keys: `DATABASE_URL` (local PG), `TOUR_DEV_ADMIN="1"` (admin bypass — no Discord
  needed locally), `TOUR_SHEETS_DIR="D:/STuffinside"` (the Google-Sheets HTML exports).
- Admin is at `/admin` (dev-admin is on locally).
- Both processes may already be running from a prior session — just open the URL.

---

## 1. What's built (all working, all local)

**Read-side showcase — DONE:**
- `/` seasons overview · `/seasons/[name]` standings (sortable) + champion/projected bracket
  + Season MVP + season leaders + draft-board link
- `/seasons/[name]/draft` — historical **draft board** (captain + picks in order)
- `/players` all-time LB · `/players/[id]` career + per-season (with **draft round** col) +
  set-win% **chart** + **MVP badges** + **H2H** table + "View on Balatro League" cross-link
- `/teams` all-time · `/teams/[id]` roster · `/hall-of-fame` · `/rules` (renders
  `docs/team-tour-rules.md` via `marked`)
- `/stats` — **Fun Stats hub**: all-time records · biggest steals · draft value by round ·
  biggest rivalries · `/stats/draft-heatmap` (per-season over/under-drafted heatmap)
- **⌘K command palette** (cmdk) + nav Search → jump to any page/season/team/player

**Write-side — PARTIAL:**
- `/admin` hub · `/admin/seasons/new` (create season) · Import buttons (ActionFlashForm)
- `/admin/seasons/[name]` **season hub** (lifecycle state machine SIGNUPS→…→DONE)
- `/admin/seasons/[name]/signups` — **signups manager** (add/approve/reject/remove) — DONE
- `/admin/seasons/[name]/draft` — **NOTE: page NOT built.** The live-draft *services* exist
  (`lib/services/draft.ts`: `setupDraft`/`getDraft`/`makePick`/`resetDraft`) + `actions.ts`
  (`setupDraftAction`/`resetDraftAction`), but there's **no draft admin UI and no
  `makePickAction`** — it was parked mid-build when priorities shifted to the showcase.
  Pick this up to finish the live draft.
- `/admin/identity` — **identity manager** (link players to real Discord ids by picking from
  the league list; merge duplicates) — DONE + verified (`lib/services/identity.ts`).

**Auth / cross-site:** NextAuth Discord **scaffold** sharing the league's session (`auth.ts`
mirrors the league: same Discord app, `AUTH_SECRET`, cookie on `.balatroleague.com`).
`/u/[discordId]` resolver built (Tour side). Not functional until env/Discord app set.

**Deploy:** prepped, not done — `railway.json`, `DEPLOY.md`, `start:prod` script, `noindex`.

---

## 2. Data state (the local DB)
Imported from `D:/STuffinside` (Google-Sheets HTML exports), idempotent:
- **4 seasons**: Team Tour 1/2/3 (SWISS), Team Tour 10 (CONFERENCES — Pluto/Eris)
- **355 players · 76 teams · ~2007 sets · 448 draft picks (56 teams) · 9 playoff series ·
  70 TT10 matchups · 4 Season MVPs**
- Re-import anytime: Admin → Import, or `POST /api/admin/import?type=historical` / `?type=tt10`.

**Identity: every player is still on a `legacy:<slug>` Discord id — the real-id mapping is
NOT applied yet.** Artifacts present:
- `apps/tour/league-players.csv` — 191 league players (name→discordId), produced by
  `web/scripts/export-league-players.mjs` reading the **live league Railway DB** (read-only).
- `apps/tour/discord-map.csv` — 60/395 auto-filled (exact league-name matches); rest manual.
- Two ways to finish: the **Identity manager UI** (`/admin/identity`), or the CSV flow
  (`npm run export:players` → fill leftovers → `npm run relink:discord -- --apply`).

---

## 3. Architecture
- **Monorepo** (npm workspaces: `packages/*`, `apps/*`). `web/` + `src/` are the **LIVE
  league** (separate app on Railway @ `balatroleague.com`) — **do not touch** unless asked;
  `web/` is its own package (not a workspace member).
- **`packages/`**: `match-core` (1v1 ban/pick/lives engine), `competition-core` (generic
  standings/tiebreaker/format/qualify/bracket kernel), `tour-core` (Tour config: bo-x norm,
  `TOUR_TIEBREAKERS`, snake `draft.ts`, ±2 `pairing.ts`). Pure + unit-tested.
- **`apps/tour`**: Next 16 / React 19 / Prisma 6 (**custom client output**
  `prisma/generated/client`). Tailwind 4 + shadcn — design system **ported verbatim from
  `web/`** (keep in sync; a shared `@balatro/ui` package would make it single-source —
  deferred).
- **Service layer rule (important):** all real logic lives in `apps/tour/lib/services/` +
  `lib/*`, called from pages / server actions / API routes. **Scripts are thin callers only**
  — the owner dislikes bespoke logic in scripts.
- **Schema** `prisma/schema/` = `core.prisma` (synced from league: Player/Match/Game…) +
  `tour.prisma`. Tour models reference core `Player`/`Match` by **plain id string** (no FK)
  — so a player **merge** repoints each reference by hand (see `lib/services/identity.ts`).

---

## 4. The "one site" plan (decided, partly built)
- **Subdomain + shared login, NOT a code merge.** League stays at apex; Tour →
  `tour.balatroleague.com`.
- **Shared SSO**: same Discord app + `AUTH_SECRET` + cookie domain → one login on both.
- **Cross-linked profiles** by `discordId` (the shared key): `/u/<discordId>` resolver on each
  site → its local profile. **Tour side built; league-side mirror NOT added** (a `/u` route +
  a link on `web/`'s `ProfileView` — needs owner OK to touch `web/`).
- **Profiles stay separate-but-linked for now**; a merged cross-DB profile is a future
  hub-level page (deferred — `discordId` keeps it possible). Same for **shared stats** across
  league+tour (the Tour can already read the league DB; defer).

---

## 5. Deploy (see `DEPLOY.md`)
- **Best way:** a **new Railway service + new Postgres in the league's existing Railway
  project**. `apps/tour/railway.json` handles the monorepo build (`npm ci` at repo root so
  `@balatro/*` link → `npm run build -w @balatro/tour`); start = `prisma db push` + `next start`.
- Set Root Directory `/`, config path `apps/tour/railway.json`, env (shared auth +
  tour `DATABASE_URL`), add the Discord redirect URL, attach the domain, then import.
- `noindex` is on → deploy "hidden", flip `app/layout.tsx` `robots.index` to launch.
- **Carry local work to prod:** `pg_dump` the local `.dev-db` → restore into the Railway
  Postgres (preserves identity-mapping work) — or re-import + redo it in prod.

---

## 6. Open items (rough priority)
1. **Apply the `discordId` mapping** (Identity manager or CSV) → lights up cross-site links.
2. **League-side `/u` mirror + a "Team Tour ↗" nav link** in `web/` (needs owner OK).
3. **Deploy** to `tour.balatroleague.com` (owner provisions Railway/DNS).
4. **Finish the live write-side:** draft admin UI (services exist) → schedule gen → ±2
   pairing → result entry → playoffs (engines all in `tour-core`).
5. **More fun stats** from `D:/STuffinside/alltime/`: ring/finals/playoff counters, rookie
   rankings, the player-vs-player H2H matrix, draft classes.
6. **Awards beyond MVP:** `alltime/Awards.html` is a column-drifting multi-block sheet —
   only the MVP block parses reliably; the other 6 need a cleaned sheet (don't auto-parse
   blind — risks wrong data publicly).
7. **Match-engine reconciliation (decisions, not bugs):** `match-core` `TOUR_POLICY`
   (ban5/pick3) is **dead + wrong** — Team Tour's real pick/ban is the league's
   `LEAGUE_POLICY` (ban 1→3→3 → choose 1 of 2), which is already `DEFAULT_POLICY`; delete
   `TOUR_POLICY` + its test. `tour-core` `TOUR_TIEBREAKERS` has 5 levels vs the 3 the rules
   publish (judgment call — extra 2 are reasonable fallbacks). `defaultBestOf` already
   defaults to 3 (correct).

---

## 7. Gotchas (Windows + this stack)
- **Install deps / do big `globals.css` rewrites with the dev server STOPPED.** A running
  dev server lock-races `npm install` (silent no-op) and serves **stale CSS chunks** (same
  hash) — fix by wiping `apps/tour/.next` + restart.
- **Zombie `next dev`/`next start` processes** survive and lock the Prisma query-engine DLL
  (EPERM on `prisma generate`) + hold ports — kill via PowerShell
  `Get-CimInstance Win32_Process | ? { $_.CommandLine -match 'next' -and $_.CommandLine -match 'dev' }`.
- **Embedded Postgres children** survive too ("pre-existing shared memory block").
- **Don't trust HTML greps** of the dev server — Next's RSC stream + React `<!-- -->` markers
  split text; verify logic by calling the **services via `tsx`** instead.
- **Node scripts** need Windows paths (`D:/STuffinside`, not `/d/...`) and
  `node --env-file=.env …` to get `DATABASE_URL`.
- The dev DB persists in `apps/tour/.dev-db` (so data survives restarts).
