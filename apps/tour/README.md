# @balatro/tour — Team Tour app

Pizza Power **Team Tour** — its own app in this monorepo, built on the shared
domain packages.

> **👉 Start with [`HANDOFF.md`](./HANDOFF.md)** — the current-state snapshot (what's
> built, how to run it, data state, deploy, open items, gotchas). Also: `AGENTS.md`
> (conventions), `DEPLOY.md` (Railway), `../../docs/team-tour-design.md` (deep design).
> **The rest of this README is stale (pre-showcase) — trust HANDOFF.md.**

## Status: Phase 0 (schema + local dev wired)

- `prisma/schema/core.prisma` — synced copy of the shared match engine schema
  (run `npm run sync:core` after editing `packages/match-core/prisma/core.prisma`).
- `prisma/schema/tour.prisma` — the Team Tour data model (Signup pool, Team,
  Conference, TourSeason, TeamSeason, Roster, Week, Matchup, TourSet, Draft,
  Playoffs, Championship, Award). References core `Player`/`Match` by **id string**
  (no cross-boundary Prisma relations — keeps the core reusable). The Prisma client
  generates to `prisma/generated/client` (custom output, so it never clobbers the
  league's default client).

## Local dev (no Docker)

```bash
cp .env.example .env                # local DATABASE_URL is already filled in
npm run dev:db                      # terminal 1: embedded Postgres on :54330 (persists in .dev-db/)
npm run db:push                     # terminal 2: create the schema in the dev DB
npm run prisma:generate             # regenerate the Tour Prisma client
npm run db:studio                   # optional: browse the DB
```

## Running the web app

`apps/tour` is the Next.js web app (the bot will be a sibling `apps/tour-bot`).

```bash
npm run dev:db                      # terminal 1: local Postgres (once)
npm run dev                         # terminal 2: Next dev server → http://localhost:3000
```

Pages so far: `/` (seasons) and `/seasons/[name]` (standings derived live via
`@balatro/competition-core`). Requires the DB imported (below).

## Importing historical data

`scripts/import/` ingests the Google-Sheets exports into the DB. Increment 1 loads
the team/roster spine (3 seasons, 56 teams, ~330 distinct players) from the alltime
"Team Rosters" sheet. Historical players get a sentinel `legacy:<slug>` Discord id
(linkable to a real account later).

```bash
SHEETS_DIR=/d/STuffinside npm run import   # with dev:db running + schema pushed
```

Idempotent (upserts). Next increments: real conferences + team seeds, set/game
results (Game Log / Work), and the playoff bracket.

The domain logic the app will call is already built and tested in
`@balatro/competition-core` (generic kernel) and `@balatro/tour-core` (schedule,
standings chain, draft, ±2 pairing, Bo-X).

## Not built yet

- The bot + web runtimes (web-first per design §13; bot needs the Tour Discord
  app token).
- Service/adapter layer wiring `tour-core`/`competition-core` to Prisma.

See the design doc §11 (Phase 0 steps), §9 (phases), §13 (architecture).
