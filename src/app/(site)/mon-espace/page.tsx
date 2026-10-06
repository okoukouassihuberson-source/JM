import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Empty } from "@/components/ui/bits";
import { OrderCard } from "@/components/site/OrderCard";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { fcfa } from "@/lib/format";
import { customerStats } from "@/lib/stats";

export default async function Dashboard() {
  const u = await requireUser("/mon-espace");
  const [st, recent, active] = await Promise.all([
    customerStats(u.id),
    query<any>("select o.*, (select count(*) from order_items where order_id = o.id) as items from orders o where user_id = $1 order by created_at desc limit 4", [u.id]),
    query<any>("select number from orders where user_id = $1 and status not in ('delivered','cancelled') order by created_at desc limit 1", [u.id]),
  ]);
  const cards = [
    { l: "Commandes en cours", v: String(st.in_progress), i: "truck" as const, c: "bg-electric-100 text-electric-500" },
    { l: "Commandes livrées", v: String(st.delivered), i: "check" as const, c: "bg-success-50 text-success-600" },
    { l: "Total dépensé", v: fcfa(st.spent), i: "wallet" as const, c: "bg-navy-900 text-white" },
  ];
  return (
    <div className="space-y-6">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Mon espace</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Bonjour {u.first_name} 👋</h1></div>
      <div className="grid gap-3 sm:grid-cols-3">
        {cards.map((c) => (
          <div key={c.l} className="card flex items-center gap-4 p-5"><span className={`grid size-12 place-items-center rounded-2xl ${c.c}`}><Icon name={c.i} /></span><div><p className="text-xs font-bold uppercase tracking-wide text-muted">{c.l}</p><p className="h-display text-3xl text-navy-900" style={{ textTransform: "none" }}>{c.v}</p></div></div>
        ))}
      </div>
      {active[0] && (
        <Link href={`/mon-espace/commandes/${active[0].number}`} className="flex items-center justify-between gap-3 rounded-2xl bg-linear-to-r from-navy-900 to-navy-600 p-5 text-white shadow-pop">
          <span className="flex items-center gap-3"><Icon name="truck" size={26} /><span><b className="block text-lg">Une commande est en cours</b><span className="text-sm text-white/75">{active[0].number} — suivre la livraison</span></span></span><Icon name="right" />
        </Link>
      )}
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="h-display text-2xl text-navy-900">Dernières commandes</h2><Link href="/mon-espace/commandes" className="text-sm font-bold text-electric-500">Tout voir</Link></div>
        {recent.length === 0 ? <Empty icon="package" title="Aucune commande pour le moment" text="Votre première commande de produits frais vous attend." href="/produits" cta="Commander" /> : <div className="space-y-3">{recent.map((o: any) => <OrderCard key={o.id} o={o} />)}</div>}
      </section>
    </div>
  );
}
