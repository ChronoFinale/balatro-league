// NextAuth v5 (Auth.js) — Discord OAuth, JWT sessions.
//
// "ONE SITE" SHARED LOGIN: Team Tour runs at tour.balatroleague.com and SHARES the
// league's session. That requires three things to MATCH the league (web/auth.ts):
//   1. the same Discord OAuth app  (DISCORD_CLIENT_ID / DISCORD_CLIENT_SECRET)
//   2. the same AUTH_SECRET        (so this app can verify the league-issued JWT)
//   3. the same cookie name + domain (__Secure-authjs.session-token on
//      AUTH_COOKIE_DOMAIN=".balatroleague.com") so the cookie is visible to both.
// Result: log in once on either host, you're logged in on both.
//
// Locally (no AUTH_COOKIE_DOMAIN) it falls back to a normal host-only cookie and
// works standalone. Add tour.balatroleague.com/api/auth/callback/discord to the
// Discord app's OAuth2 redirect URLs.

import NextAuth from "next-auth";
import Discord from "next-auth/providers/discord";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  // Share the session cookie across *.balatroleague.com when the domain is set
  // (prod). Must match the league's cookie config exactly to read its session.
  ...(process.env.AUTH_COOKIE_DOMAIN
    ? {
        cookies: {
          sessionToken: {
            name: "__Secure-authjs.session-token",
            options: {
              httpOnly: true,
              sameSite: "lax" as const,
              path: "/",
              secure: true,
              domain: process.env.AUTH_COOKIE_DOMAIN,
            },
          },
        },
      }
    : {}),
  providers: [
    Discord({
      // Same Discord application as the league (shared login).
      clientId: process.env.DISCORD_CLIENT_ID,
      clientSecret: process.env.DISCORD_CLIENT_SECRET,
      authorization: { params: { scope: "identify" } },
    }),
  ],
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 }, // 7 days
  callbacks: {
    async jwt({ token, profile }) {
      // Only runs on a fresh sign-in ON this host; when the session was minted by
      // the league, we just READ the existing token below.
      if (profile) {
        token.discordId = profile.id as string;
        token.username = (profile.username as string) ?? token.name;
        token.avatar = (profile.avatar as string) ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.discordId) (session.user as { discordId?: string }).discordId = token.discordId as string;
      if (token.username) session.user.name = token.username as string;
      if (token.avatar !== undefined) (session.user as { avatar?: string | null }).avatar = token.avatar as string | null;
      return session;
    },
  },
  pages: { signIn: "/auth/signin" },
});
