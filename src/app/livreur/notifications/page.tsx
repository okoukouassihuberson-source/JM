import type { Metadata } from "next";
import Link from "next/link";
import { markNotificationsReadAction } from "@/actions/account";
import { ActionButton } from "@/components/ui/ActionForm";
import { Empty } from "@/components/ui/bits";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function DriverNotifs() {
  const u = await requirePage("driver.access", "/livreur/notifications");
  const list = await query<any>("select * from notifications where user_id = $1 order by created_at desc limit 50", [u.id]);
  return (
    <>
      <Link href="/livreur" className="text-xs font-bold text-electric-500">← Mes livraisons</Link>
      <div className="flex items-end justify-between"><h1 className="h-display text-4xl text-navy-900">Notifications</h1>{list.some((n) => !n.read_at) && <ActionButton action={markNotificationsReadAction} className="btn-outline btn-sm" successToast={false}>Tout lu</ActionButton>}</div>
      {list.length === 0 ? <Empty icon="bell" title="Aucune notification" /> : (
        <ul className="space-y-2">{list.map((n) => (
          <li key={n.id}><Link href={n.link ?? "/livreur"} className={`card block p-3.5 ${n.read_at ? "opacity-70" : "border-electric-400/60"}`}><b className="block text-navy-900">{n.title}</b><span className="text-sm text-muted">{n.body}</span><span className="mt-0.5 block text-xs text-muted/80">{timeAgo(n.created_at)}</span></Link></li>))}</ul>)}
    </>
  );
}
