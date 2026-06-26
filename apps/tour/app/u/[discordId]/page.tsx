import Link from "next/link";
import { redirect } from "next/navigation";
import { playerIdByDiscord } from "@/lib/stats";

export const dynamic = "force-dynamic";

// Cross-site resolver: /u/<discordId> → that player's Team Tour profile. The
// league deep-links here by Discord id (the shared identity key), so it never
// needs to know our internal player ids.
export default async function ResolveByDiscord({ params }: { params: Promise<{ discordId: string }> }) {
  const { discordId } = await params;
  const player = await playerIdByDiscord(discordId);
  if (player) redirect(`/players/${player.id}`);

  return (
    <main>
      <h1>Not on Team Tour</h1>
      <p className="sub">
        This player isn&apos;t in the Team Tour records. <Link href="/players">All players →</Link>
      </p>
    </main>
  );
}
