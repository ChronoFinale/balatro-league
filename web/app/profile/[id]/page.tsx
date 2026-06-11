// Thin route wrapper — the actual UI lives in the shared <ProfileView>, which
// /me renders too (no redirect). This page just maps the [id] param +
// dispute query flags onto it.
import { ProfileView } from "@/components/ProfileView";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ disputeOk?: string; disputeErr?: string }>;
}) {
  const { id } = await params;
  const { disputeOk, disputeErr } = await searchParams;
  return <ProfileView playerId={id} disputeOk={disputeOk} disputeErr={disputeErr} />;
}
