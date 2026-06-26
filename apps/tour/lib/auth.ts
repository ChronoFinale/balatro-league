// Auth gate. Real auth = NextAuth Discord OAuth + RoleBinding tiers (design §13.7),
// wired when the Tour Discord app exists. For now:
//  - web (server actions / pages): local dev is admin via TOUR_DEV_ADMIN=1.
//  - API routes: a Bearer TOUR_ADMIN_TOKEN (for programmatic callers / the bot),
//    falling back to the dev flag locally.
// Services in lib/services/ stay auth-agnostic; the CALLER (route/action) gates.

export function isAdmin(): boolean {
  return process.env.TOUR_DEV_ADMIN === "1";
}

export function assertAdmin(): void {
  if (!isAdmin()) throw new Error("Forbidden: admin only");
}

export function isApiAdmin(req: Request): boolean {
  const token = process.env.TOUR_ADMIN_TOKEN;
  if (token && req.headers.get("authorization") === `Bearer ${token}`) return true;
  return isAdmin();
}
