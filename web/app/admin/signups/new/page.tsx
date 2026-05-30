import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listGuildTextChannels } from "@/lib/discord";
import { SiteNav } from "@/components/SiteNav";
import { AdminNav } from "@/components/AdminNav";
import { createRound } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewSignupRoundPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string }>;
}) {
  await requireAdmin();
  const { err } = await searchParams;

  const guildId = process.env.DISCORD_GUILD_ID;
  if (!guildId) {
    redirect("/admin/signups?err=no-guild-id");
  }
  const channels = await listGuildTextChannels(guildId);

  return (
    <>
      <SiteNav activePath="/admin" />
      <AdminNav activePath="/admin/signups" />
      <main>
        <h2>New signup round</h2>
        <p className="muted">
          Posts a signup embed in your chosen Discord channel. Players click Sign Up to register;
          the embed re-renders live as they join.
        </p>

        {err && (
          <div className="card" style={{ borderColor: "#e74c3c", color: "#e74c3c" }}>
            {err === "post-failed" && "Failed to post the signup message to Discord — check the bot's permissions in that channel."}
            {err === "missing-name" && "Round name is required."}
            {err === "missing-channel" && "Pick a channel."}
            {err === "no-channels" && "No channels available. Make sure the bot is in your server."}
          </div>
        )}

        <form action={createRound} className="card" style={{ display: "grid", gap: 12, maxWidth: 520 }}>
          <label>
            <strong>Round name</strong>
            <input type="text" name="name" required placeholder="Season 2 Signups" style={{ width: "100%", marginTop: 4 }} />
          </label>

          <label>
            <strong>Channel</strong>
            {channels.length === 0 ? (
              <p className="muted">No text channels found — the bot may not be in this server.</p>
            ) : (
              <select name="channelId" required style={{ width: "100%", marginTop: 4 }}>
                <option value="">— Pick a channel —</option>
                {channels.map((c) => (
                  <option key={c.id} value={c.id}>#{c.name}</option>
                ))}
              </select>
            )}
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" disabled={channels.length === 0}>Open round</button>
            <Link href="/admin/signups" className="secondary">Cancel</Link>
          </div>
        </form>
      </main>
    </>
  );
}
