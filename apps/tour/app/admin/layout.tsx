import Link from "next/link";
import { Settings, Fingerprint, Users, Activity, LayoutDashboard } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { Callout } from "@/components/Callout";

export const dynamic = "force-dynamic";

// Admin sub-nav — every /admin page is wrapped in this shell so the area is unmistakable
// (distinct "Admin mode" bar) and consistently navigable. The gate lives here too, so each
// page no longer needs its own admins-only check.
const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/identity", label: "Identity", icon: Fingerprint },
  { href: "/admin/teams", label: "Teams", icon: Users },
  { href: "/admin/env-health", label: "System", icon: Activity },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) {
    return (
      <main>
        <h1>Admin</h1>
        <Callout type="admin">Admins only — you don&apos;t have access.</Callout>
      </main>
    );
  }
  return (
    <>
      <div className="admin-bar">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-5 gap-y-1 px-6 py-2">
          <span className="admin-badge"><Settings className="size-3.5" /> Admin mode</span>
          <nav className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px]">
            {ADMIN_NAV.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="admin-link inline-flex items-center gap-1.5">
                <Icon className="size-3.5" /> {label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
      {children}
    </>
  );
}
