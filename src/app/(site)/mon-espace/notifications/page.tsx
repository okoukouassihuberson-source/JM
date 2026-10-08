import type { Metadata } from "next";
import Link from "next/link";
import { markNotificationsReadAction } from "@/actions/account";
import { ActionButton } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Empty } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { PushToggle } from "@/components/PushToggle";
import { pushEnabled } from "@/lib/push";
import { timeAgo } from "@/lib/format";

export const metadata: Metadata = { title: "Notifications" };

export default async function Notifs() {
  const u = await requireUser("/mon-espace/notifications");
  const list = await query<any>("select * from notifications where user_id = $1 order by created_at desc limit 60", [u.id]);
  const unread = list.filter((n) => !n.read_at).length;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Notifications</h1>
        {unread > 0 && <ActionButton action={markNotificationsReadAction} successToast={false}>Tout marquer comme lu</ActionButton>}</div>
      {pushEnabled() && <PushToggle publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!} />}
      {list.length === 0 ? <Empty icon="bell" title="Aucune notification" text="Vous serez prévenu à chaque étape de vos commandes." /> : (
        <ul className="space-y-2">{list.map((n) => (
          <li key={n.id}><Link href={n.link ?? "#"} className={`card flex items-start gap-3 p-4 transition hover:shadow-pop ${n.read_at ? "opacity-75" : "border-electric-400/50"}`}>
            <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${n.read_at ? "bg-slate-100 text-muted" : "bg-electric-100 text-electric-500"}`}><Icon name={n.type.includes("deliver") || n.type.includes("driver") ? "truck" : n.type.includes("stock") ? "alert" : "bell"} size={18} /></span>
            <span className="min-w-0 flex-1"><span className="block font-extrabold text-navy-900">{n.title}</span><span className="block text-sm text-muted">{n.body}</span><span className="text-xs text-muted/80">{timeAgo(n.created_at)}</span></span>
            {!n.read_at && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-electric-500" />}</Link></li>))}</ul>)}
    </div>
  );
}
