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
        Auth is scaffolded but not yet live — the Tour Discord application hasn&apos;t been created. Sign-in works once
        its credentials are set in <code>apps/tour/.env</code>.
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
