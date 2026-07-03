# Team Tour Bot (`apps/tour-bot`)

The Pizza Power Team Tour Discord bot — **thin hands over the tour web app**. It holds no
database models and no domain logic: every read/write goes through `apps/tour`'s
`/api/bot/*` routes (Bearer `TOUR_ADMIN_TOKEN`), and the web pushes work to it via
pg-boss jobs on the shared tour Postgres. One service layer; an action from Discord and
the same action on the site run identical code.

## What it does (phases)

- **C1 (now):** season Player/Captain role provisioning + reconciliation
  (`tour.roles.reconcile` jobs from roster changes + a daily self-heal cron + the
  "Sync now" button on `/admin/seasons/<name>/discord`).
- C2+: results announcements, on-the-clock/turn/deadline pings, `/ppt` slash commands,
  guided match threads (see `docs/team-tour-roles-bot-roadmap.md`).

## Env

| Var | What |
|---|---|
| `DISCORD_TOKEN` | The Tour bot's own Discord application token (enable the **Server Members** intent) |
| `TOUR_GUILD_ID` | The guild to operate in — the Pizza Power server, or a TEST guild for dry runs |
| `DATABASE_URL` | The tour Postgres (pg-boss only) |
| `TOUR_WEB_URL` | The tour web app, e.g. `https://tour.balatroleague.com` (or the staging site) |
| `TOUR_ADMIN_TOKEN` | Must match the web's `TOUR_ADMIN_TOKEN` |
| `PORT` | Railway healthcheck port (defaults 8080) |

## Run

```
npm run dev    # tsx watch (from apps/tour-bot)
npm run build && npm start
```

Dry runs: point `TOUR_GUILD_ID` at a test server + `TOUR_WEB_URL` at the staging site;
going live is an env flip.
