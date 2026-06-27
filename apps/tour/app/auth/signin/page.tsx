import { signIn } from "@/auth";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/Callout";

export const metadata = { title: "Sign in · Team Tour" };

export default function SignIn() {
  return (
    <main>
      <h1>Sign in</h1>
      <p className="sub">
        Sign in with Discord to access your Team Tour profile, captain tools, and admin.
      </p>
      <Callout type="info">
        Shared login with the league: sign in once on either site. Requires the Discord OAuth credentials
        (<code>DISCORD_CLIENT_ID</code> / <code>DISCORD_CLIENT_SECRET</code> / <code>AUTH_SECRET</code>) in{" "}
        <code>apps/tour/.env</code> — see <code>.env.example</code>.
      </Callout>
      <form
        action={async () => {
          "use server";
          await signIn("discord", { redirectTo: "/" });
        }}
      >
        <Button type="submit">Continue with Discord</Button>
      </form>
    </main>
  );
}
