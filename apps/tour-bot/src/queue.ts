// pg-boss workers — the bot's job intake (league src/queue.ts pattern). The web enqueues
// (apps/tour/lib/queue.ts); this side owns the workers. Connection budget: max 3.
//
// Jobs:
//   tour.roles.reconcile { season }  — sync a season's Player/Captain roles (also daily cron).
import { PgBoss } from "pg-boss";
import type { Client, Guild } from "discord.js";
import { env } from "./env";
import { apiGet } from "./api";
import { reconcileSeasonRoles } from "./roles";

const RECONCILE_QUEUE = "tour.roles.reconcile";

async function guildOf(client: Client): Promise<Guild> {
  return client.guilds.cache.get(env.TOUR_GUILD_ID) ?? (await client.guilds.fetch(env.TOUR_GUILD_ID));
}

export async function startQueue(client: Client): Promise<PgBoss> {
  const boss = new PgBoss({ connectionString: env.DATABASE_URL, schema: "pgboss", max: 3 });
  boss.on("error", (err: Error) => console.warn("[pg-boss] error:", err));
  await boss.start();

  await boss.createQueue(RECONCILE_QUEUE).catch(() => {});
  await boss.work(RECONCILE_QUEUE, { batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      const { season } = job.data as { season: string };
      if (!season) continue;
      const guild = await guildOf(client);
      const r = await reconcileSeasonRoles(guild, season);
      console.log(
        `[roles] ${season}: +${r.added} -${r.removed} (skipped ${r.skipped}, unmappable ${r.unmappable})` +
          `${r.provisioned.length ? ` provisioned ${r.provisioned.join(" ")}` : ""}${r.addsOnly ? " [adds-only: no GuildMembers intent]" : ""}`,
      );
    }
  });

  // Daily self-heal: reconcile every ACTIVE-ish season (drift from manual Discord edits).
  const CRON_QUEUE = "tour.roles.reconcile-all";
  await boss.createQueue(CRON_QUEUE).catch(() => {});
  await boss.work(CRON_QUEUE, { batchSize: 1 }, async () => {
    const seasons = await apiGet<{ seasons?: { name: string; state?: string }[] } | { name: string; state?: string }[]>("/api/admin/seasons");
    const list = Array.isArray(seasons) ? seasons : (seasons.seasons ?? []);
    for (const s of list) {
      // Only live-ish seasons need role upkeep; DONE seasons keep their roles frozen.
      if (s.state && ["SIGNUPS", "DRAFTING", "REGULAR", "PLAYOFFS"].includes(s.state)) {
        await boss.send(RECONCILE_QUEUE, { season: s.name }, { singletonKey: `roles:${s.name}`, singletonSeconds: 30 });
      }
    }
  });
  await boss.schedule(CRON_QUEUE, "0 7 * * *"); // daily 07:00 UTC (league pattern)

  console.log("[pg-boss] workers ready");
  return boss;
}
