import Link from "next/link";
import { BarChart, Donut, HBars, StatCard } from "@/components/admin/charts";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/bits";
import { requirePage } from "@/lib/auth";
import { fcfa, fmtDateTime, num } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";
import { dashboardStats } from "@/lib/stats";
import { query } from "@/db";

export default async function AdminHome() {
  await requirePage("dashboard.view", "/admin");
  const [s, drivers] = await Promise.all([
    dashboardStats(),
    query<any>(`select u.first_name, u.last_name, dr.status,
        count(d.id) filter (where d.status = 'delivered') ok, count(d.id) filter (where d.status = 'failed') ko,
        count(d.id) filter (where d.status in ('assigned','accepted','en_route','arrived')) active
      from drivers dr join users u on u.id = dr.user_id left join deliveries d on d.driver_id = dr.id group by u.id, dr.id order by ok desc`),
  ]);
  const st = s.statuses;
  const pending = (st.received ?? 0) + (st.payment_confirmed ?? 0);
  const preparing = (st.preparing ?? 0) + (st.ready ?? 0) + (st.handed_to_driver ?? 0);
  const donut = [
    ["received", "#1e6bff"], ["payment_confirmed", "#7db3ff"], ["preparing", "#f59e0b"], ["handed_to_driver", "#fbbf24"], ["out_for_delivery", "#0a1a52"], ["delivered", "#16a34a"], ["delivery_failed", "#ee2b33"], ["cancelled", "#94a3b8"],
  ].map(([k, c]) => ({ label: STATUS_LABEL[k as OrderStatus], value: st[k] ?? 0, color: c }));
  const dTotal = s.delivery.delivered + s.delivery.failed;
  return (
    <div className="space-y-6">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Vue d&apos;ensemble</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Tableau de bord</h1></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="CA aujourd'hui" value={fcfa(s.rev.today)} sub={`${s.rev.orders_today} commande(s)`} icon={<Icon name="wallet" />} tone="navy" />
        <StatCard label="CA cette semaine" value={fcfa(s.rev.week)} icon={<Icon name="chart" />} tone="blue" />
        <StatCard label="CA du mois" value={fcfa(s.rev.month)} icon={<Icon name="receipt" />} tone="blue" />
        <StatCard label="Stock faible" value={String(s.lowStock.length)} sub="produit(s) sous le seuil" icon={<Icon name="alert" />} tone={s.lowStock.length ? "orange" : "green"} />
        <StatCard label="En attente" value={String(pending)} sub="à traiter" icon={<Icon name="clock" />} tone="red" />
        <StatCard label="En préparation" value={String(preparing)} icon={<Icon name="package" />} tone="orange" />
        <StatCard label="En livraison" value={String(st.out_for_delivery ?? 0)} icon={<Icon name="truck" />} tone="navy" />
        <StatCard label="Livrées" value={String(st.delivered ?? 0)} sub={`${Object.values(st).reduce((a, b) => a + b, 0)} commandes au total`} icon={<Icon name="check" />} tone="green" />
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2"><div className="mb-3 flex items-baseline justify-between"><h2 className="h-display text-2xl text-navy-900">Chiffre d&apos;affaires — 14 jours</h2><span className="text-xs text-muted">hors commandes annulées</span></div>
          <BarChart data={s.daily.map((d) => ({ label: d.day.slice(8), value: d.revenue, sub: `${d.day.slice(8)}/${d.day.slice(5, 7)} · ${d.orders} cmd` }))} /></section>
        <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-navy-900">Commandes par statut</h2><Donut data={donut} /></section>
        <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-navy-900">Produits les plus vendus</h2><HBars data={s.topProducts.map((p) => ({ label: p.name, value: p.revenue, hint: `${num(p.qty)} ${p.unit_label}` }))} /></section>
        <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-navy-900">Catégories les plus vendues</h2><HBars data={s.topCategories.map((c) => ({ label: c.name, value: c.revenue }))} /></section>
        <section className="card p-5">
          <h2 className="h-display mb-4 text-2xl text-navy-900">Performance des livraisons</h2>
          <div className="mb-4 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-success-50 p-3"><p className="h-display text-3xl text-success-600">{dTotal ? Math.round((s.delivery.delivered / dTotal) * 100) : 0}%</p><p className="text-[11px] font-bold uppercase text-muted">Réussite</p></div><div className="rounded-xl bg-electric-50 p-3"><p className="h-display text-3xl text-navy-900">{s.delivery.avg_minutes}<span className="text-base"> min</span></p><p className="text-[11px] font-bold uppercase text-muted">Délai moyen</p></div><div className="rounded-xl bg-promo-50 p-3"><p className="h-display text-3xl text-promo-600">{s.delivery.failed}</p><p className="text-[11px] font-bold uppercase text-muted">Échecs</p></div></div>
          <ul className="divide-y divide-line text-sm">{drivers.map((d: any) => <li key={d.first_name + d.last_name} className="flex items-center justify-between py-2"><span className="font-semibold">{d.first_name} {d.last_name[0]}.</span><span className="text-muted">{d.ok} livrées · {d.ko} échec(s)</span></li>)}</ul>
        </section>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className="card p-5"><div className="mb-3 flex items-center justify-between"><h2 className="h-display text-2xl text-navy-900">Alertes stock</h2><Link href="/admin/stock" className="text-sm font-bold text-electric-500">Gérer</Link></div>
          {s.lowStock.length === 0 ? <p className="text-sm text-muted">Tous les stocks sont au-dessus du seuil d&apos;alerte. 👍</p> : <ul className="space-y-2">{s.lowStock.map((p: any) => <li key={p.id} className="flex items-center justify-between rounded-xl bg-warning-50 px-3 py-2.5 text-sm"><span className="font-bold text-navy-900">{p.name}</span><span className="font-extrabold text-warning-600">⚠ {num(p.available)} {p.unit_label} <span className="font-normal text-muted">/ seuil {num(p.alert_threshold)}</span></span></li>)}</ul>}</section>
        <section className="card p-5"><div className="mb-3 flex items-center justify-between"><h2 className="h-display text-2xl text-navy-900">Dernières commandes</h2><Link href="/admin/commandes" className="text-sm font-bold text-electric-500">Toutes</Link></div>
          <ul className="divide-y divide-line">{s.recent.map((o: any) => <li key={o.number}><Link href={`/admin/commandes/${o.number}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-electric-500"><span><b className="block">{o.number}</b><span className="text-xs text-muted">{o.customer_name} · {fmtDateTime(o.created_at)}</span></span><span className="text-right"><b className="block">{fcfa(o.total)}</b><span className={`badge ${STATUS_TONE[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</span></span></Link></li>)}</ul></section>
      </div>
      <Badge tone="gray">Données en temps réel depuis la base PostgreSQL</Badge>
    </div>
  );
}
