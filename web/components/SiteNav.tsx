// Shared site nav. Server component. Highlights the active path.
import Link from "next/link";

const PUBLIC_LINKS = [
  { href: "/standings", label: "Standings" },
  { href: "/players", label: "Players" },
  { href: "/seasons", label: "Past seasons" },
] as const;

export function SiteNav({ activePath }: { activePath: string }) {
  return (
    <header className="site-nav">
      <h1>🃏 Balatro League</h1>
      <nav>
        {PUBLIC_LINKS.map((link) => {
          const isActive = link.href === activePath;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? "active" : ""}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
