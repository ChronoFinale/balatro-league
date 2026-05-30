import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Balatro League",
  description: "League standings, schedules, and history",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
