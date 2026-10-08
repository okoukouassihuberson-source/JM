import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { Icon } from "@/components/ui/Icon";
import { NotificationBell } from "@/components/NotificationBell";
import { one } from "@/db";
import { requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Espace livreur", robots: { index: false, follow: false } };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const u = await requirePage("driver.access", "/livreur");
  const unread = (await one<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and read_at is null", [u.id]))!.n;
  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-ice pb-10">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 text-white shadow-card">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-electric-500"><Icon name="truck" /></span><div><p className="text-xs text-white/60">Espace livreur</p><p className="font-extrabold leading-tight">{u.first_name} {u.last_name}</p></div></div>
        <div className="flex items-center gap-1"><NotificationBell initial={unread} href="/livreur/notifications" />
          <form action={logoutAction}><button className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Déconnexion"><Icon name="logout" /></button></form></div>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}
