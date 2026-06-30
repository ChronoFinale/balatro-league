import type { Metadata } from "next";
import Link from "next/link";
import { Silkscreen } from "next/font/google";
import { Pizza, CalendarDays, Users, Shield, Trophy, BarChart3, ScrollText, Settings, ExternalLink } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { CommandPalette } from "@/components/CommandPalette";
import { CommandButton } from "@/components/CommandButton";
import { UserMenu } from "@/components/UserMenu";
import { isAdmin } from "@/lib/auth";
import "./globals.css";

// Balatro-ish pixel font for headings (matches the league site).
const pixel = Silkscreen({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "Team Tour",
  description: "Pizza Power Team Tour — standings, rosters, brackets, history",
  // WIP / "hidden": deploy freely without it getting indexed. Remove (or set
  // index:true) when you're ready to make it public.
  robots: { index: false, follow: false },
};

// The sibling league site (same design, shared login). Env-overridable for staging.
const LEAGUE_URL = process.env.NEXT_PUBLIC_LEAGUE_URL || "https://balatroleague.com";

const NAV = [
  { href: "/", label: "Seasons", icon: CalendarDays },
  { href: "/players", label: "Players", icon: Users },
  { href: "/teams", label: "Teams", icon: Shield },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/hall-of-fame", label: "Hall of Fame", icon: Trophy },
  { href: "/rules", label: "Rules", icon: ScrollText },
];

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Only admins see the Admin entry — everyone else never knows it's there.
  const admin = await isAdmin();
  const nav = admin ? [...NAV, { href: "/admin", label: "Admin", icon: Settings }] : NAV;
  return (
    <html lang="en" className={pixel.variable}>
      <body>
        <header className="border-b border-border">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-3">
            <Link href="/" className="brand flex items-center gap-2 text-[15px] font-bold text-foreground hover:no-underline">
              <Pizza className="size-5 text-[var(--accent)]" />
              Team Tour
            </Link>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
              {nav.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground hover:no-underline"
                >
                  <Icon className="size-4" />
                  {label}
                </Link>
              ))}
              <a
                href={LEAGUE_URL}
                className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground hover:no-underline"
                title="Balatro League"
              >
                <ExternalLink className="size-4" />
                League
              </a>
              <CommandButton />
              <UserMenu />
            </nav>
          </div>
        </header>
        {children}
        <CommandPalette />
        <Toaster />
      </body>
    </html>
  );
}
