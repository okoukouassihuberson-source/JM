import type { Metadata } from "next";
import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { MonEspaceNav } from "@/components/site/MonEspaceNav";
import { Icon } from "@/components/ui/Icon";
import { one } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: { default: "Mon espace", template: "%s | Mon espace" }, robots: { index: false, follow: false } };

export default async function EspaceLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser("/mon-espace");
  const unread = (await one<{ n: number }>("select count(*) n from notifications where user_id = $1 and read_at is null", [u.id]))!.n;
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:grid lg:grid-cols-[240px_1fr] lg:gap-8 lg:py-10">
      <aside className="mb-5 lg:mb-0">
        <div className="card mb-3 hidden items-center gap-3 p-4 lg:flex">
          <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-lg font-extrabold text-white">{u.first_name[0]}{u.last_name[0]}</span>
          <div className="min-w-0"><p className="truncate font-extrabold text-navy-900">{u.first_name} {u.last_name}</p><p className="text-xs text-muted">{u.role_label}</p></div>
        </div>
        <MonEspaceNav unread={unread} />
        <form action={logoutAction} className="mt-3 hidden lg:block"><button className="btn-ghost w-full justify-start text-muted"><Icon name="logout" size={18} /> Déconnexion</button></form>
        {u.role_key !== "client" && <Link href="/admin" className="btn-navy btn-sm mt-3 hidden w-full lg:flex">Espace professionnel</Link>}
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
