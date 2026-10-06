import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { Icon } from "@/components/ui/Icon";
import { requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Espace livreur", robots: { index: false, follow: false } };

export default async function DriverLayout({ children }: { children: React.ReactNode }) {
  const u = await requirePage("driver.access", "/livreur");
  return (
    <div className="mx-auto min-h-dvh max-w-xl bg-ice pb-10">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 text-white shadow-card">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-full bg-electric-500"><Icon name="truck" /></span><div><p className="text-xs text-white/60">Espace livreur</p><p className="font-extrabold leading-tight">{u.first_name} {u.last_name}</p></div></div>
        <div className="flex items-center gap-1"><Link href="/mon-espace/notifications" className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Notifications"><Icon name="bell" /></Link>
          <form action={logoutAction}><button className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Déconnexion"><Icon name="logout" /></button></form></div>
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}
