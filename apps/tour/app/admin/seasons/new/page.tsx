import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isAdmin } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSeasonAction } from "../../actions";

// Creation is deliberately MINIMAL: team count, team size, format, and conferences all
// depend on how many people sign up — they're decided later in Season settings (during
// the signups-closed committee window), not guessed here.
export default async function NewSeason() {
  if (!(await isAdmin())) {
    return (
      <main>
        <h1>Admins only</h1>
        <p className="sub">You don&apos;t have access to this page.</p>
      </main>
    );
  }

  return (
    <main>
      <p>
        <Link href="/admin" className="inline-flex items-center gap-1"><ArrowLeft className="size-3.5" /> admin</Link>
      </p>
      <h1>New Season</h1>
      <form action={createSeasonAction} className="card flex max-w-[480px] flex-col gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" required placeholder="e.g. Team Tour 11" />
        </div>
        <p className="sub" style={{ margin: 0 }}>
          That&apos;s all you need — format, team size, and conferences are decided later in
          Season settings, once signups tell you how big the field is.
        </p>
        <Button type="submit" className="self-start">Create season</Button>
      </form>
    </main>
  );
}
