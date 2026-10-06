import { AutoRefresh } from "@/components/AutoRefresh";
import { DriverCard } from "@/components/driver/DriverCard";
import { GpsToggle } from "@/components/driver/GpsToggle";
import { Availability } from "@/components/driver/Availability";
import { Empty } from "@/components/ui/bits";
import { query, one } from "@/db";
import { requirePage } from "@/lib/auth";
import { fcfa, fmtTime } from "@/lib/format";

export default async function Livreur() {
  const u = await requirePage("driver.access", "/livreur");
  const me = await one<any>("select * from drivers where user_id = $1", [u.id]);
  if (!me) return <Empty icon="truck" title="Profil livreur non configuré" text="Demandez au gérant de finaliser votre profil." />;
  const jobs = await query<any>(
    `select d.order_id, d.status as delivery_status, d.accepted_at, o.number, o.status as order_status, o.customer_name, o.customer_phone, o.delivery_phone,
            o.quartier, o.commune, o.address_line, o.landmark, o.instructions, o.total, o.payment_method, p.status as pay_status,
            coalesce((select json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'unit', oi.unit, 'unit_label', oi.unit_label)) from order_items oi where oi.order_id = o.id), '[]') as items
       from deliveries d join orders o on o.id = d.order_id left join payments p on p.order_id = o.id
      where d.driver_id = $1 and o.status in ('preparing','handed_to_driver','out_for_delivery') order by o.created_at`, [me.id]);
  const done = await query<any>(
    `select o.number, o.status, o.total, d.delivered_at, d.failed_at from deliveries d join orders o on o.id = d.order_id
      where d.driver_id = $1 and o.status in ('delivered','delivery_failed') and coalesce(d.delivered_at, d.failed_at) > now() - interval '1 day' order by coalesce(d.delivered_at, d.failed_at) desc`, [me.id]);
  const stats = await one<any>("select count(*) filter (where status = 'delivered') ok, count(*) filter (where status = 'failed') ko from deliveries where driver_id = $1", [me.id]);
  const enRoute = jobs.some((j) => j.order_status === "out_for_delivery");
  return (
    <>
      <AutoRefresh seconds={20} />
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Aujourd&apos;hui</p><h1 className="h-display text-4xl text-navy-900">Mes livraisons</h1></div>
      <div className="grid grid-cols-3 gap-2 text-center">
        {[["À faire", jobs.length], ["Livrées (jour)", done.filter((d) => d.status === "delivered").length], ["Total livrées", stats.ok]].map(([l, v]) => <div key={String(l)} className="card p-3"><p className="h-display text-3xl text-navy-900">{v}</p><p className="text-[11px] font-bold uppercase text-muted">{l}</p></div>)}
      </div>
      <Availability status={me.status} />
      <GpsToggle active={enRoute} />
      {jobs.length === 0 ? <Empty icon="truck" title="Aucune livraison en cours" text="Vous serez notifié dès qu'une commande vous est affectée." /> : jobs.map((j) => <DriverCard key={j.order_id} d={j} />)}
      {done.length > 0 && (
        <section><h2 className="h-display mb-2 mt-4 text-2xl text-navy-900">Terminées (24 h)</h2>
          <ul className="space-y-2">{done.map((d) => <li key={d.number} className="card flex items-center justify-between p-3 text-sm"><span><b>#{d.number}</b><br /><span className="text-xs text-muted">{fmtTime(d.delivered_at ?? d.failed_at)}</span></span><span className="text-right"><b>{fcfa(d.total)}</b><br /><span className={`text-xs font-bold ${d.status === "delivered" ? "text-success-600" : "text-promo-600"}`}>{d.status === "delivered" ? "Livrée" : "Échec"}</span></span></li>)}</ul></section>
      )}
    </>
  );
}
