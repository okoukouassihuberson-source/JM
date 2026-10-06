import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateOrderInfoAction } from "@/actions/admin-orders";
import { AutoRefresh } from "@/components/AutoRefresh";
import { OrderTimeline } from "@/components/OrderTimeline";
import { OrderActions } from "@/components/admin/OrderActions";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";
import { displayPhone, fcfa, fmtDateTime, formatQty } from "@/lib/format";
import { getOrderDetail } from "@/lib/order-view";
import { METHOD_LABEL, PAY_STATUS_LABEL, PAYMENT_LABEL, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> { return { title: `Commande ${(await params).number}` }; }

export default async function AdminOrder({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const u = await requirePage("orders.view", `/admin/commandes/${number}`);
  const d = await getOrderDetail(number);
  if (!d) notFound();
  const { order: o, items, payment, delivery, history, invoice, customer } = d;
  const drivers = await query<any>("select dr.id, u.first_name || ' ' || u.last_name as name, dr.status from drivers dr join users u on u.id = dr.user_id where u.active order by u.first_name");
  const st = o.status as OrderStatus;
  const pickup = o.delivery_method === "pickup";
  const canAct = can(u, "orders.prepare") || can(u, "orders.manage") || can(u, "payments.manage") || can(u, "orders.cancel");
  return (
    <div className="space-y-5">
      <AutoRefresh seconds={30} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Link href="/admin/commandes" className="text-xs font-bold text-electric-500">← Commandes</Link><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">#{o.number}</h1><p className="text-sm text-muted">{fmtDateTime(o.created_at)} · {METHOD_LABEL[o.delivery_method as keyof typeof METHOD_LABEL]}</p></div>
        <div className="flex items-center gap-2"><span className={`badge text-xs ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>{invoice && <a href={`/api/invoices/${o.number}`} className="btn-outline btn-sm"><Icon name="download" size={14} /> {invoice.number}</a>}</div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section className="card grid gap-5 p-5 sm:grid-cols-2">
            <div><h2 className="label">Client</h2><p className="font-extrabold text-navy-900">{customer.first_name} {customer.last_name}</p><a href={`tel:+${o.customer_phone}`} className="text-sm font-bold text-electric-500">{displayPhone(o.customer_phone)}</a></div>
            <div><h2 className="label">{pickup ? "Retrait" : "Livraison"}</h2>{pickup ? <p className="text-sm">Retrait sur place</p> : <p className="text-sm">{o.address_line}<br />{o.quartier}, {o.commune}{o.landmark && <><br /><span className="text-muted">Repère : {o.landmark}</span></>}<br /><span className="text-muted">{o.zone_name} · tél {displayPhone(o.delivery_phone)}</span>{o.instructions && <><br /><b>Instructions :</b> {o.instructions}</>}</p>}</div>
            <div><h2 className="label">Paiement</h2><p className="text-sm">{PAYMENT_LABEL[o.payment_method]} — <b className={payment?.status === "paid" ? "text-success-600" : "text-warning-600"}>{PAY_STATUS_LABEL[payment?.status ?? "pending"]}</b>{payment?.reference && <><br />Réf. client : <b>{payment.reference}</b></>}{payment?.paid_at && <><br /><span className="text-muted">Le {fmtDateTime(payment.paid_at)}</span></>}</p></div>
            <div><h2 className="label">Livreur</h2><p className="text-sm">{delivery?.driver_first ? <><b>{delivery.driver_first} {delivery.driver_last}</b> · {displayPhone(delivery.driver_phone)}<br /><span className="text-muted">Statut : {delivery.status}{delivery.eta && ` · ETA ${fmtDateTime(delivery.eta)}`}</span></> : <span className="text-muted">Non affecté</span>}{delivery?.proof_comment && <><br /><span className="text-muted">Note livreur : {delivery.proof_comment}</span></>}</p>
              {delivery?.proof_photo_url && <a href={delivery.proof_photo_url} target="_blank" className="text-xs font-bold text-electric-500 underline">Voir la photo de preuve</a>}
              {delivery?.failure_reason && <p className="mt-1 text-sm font-semibold text-promo-600">Échec : {delivery.failure_reason}</p>}</div>
          </section>
          <section className="card overflow-x-auto"><table className="w-full min-w-[520px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Produit", "Quantité", "Prix unitaire", "Total"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-line">{items.map((i: any) => <tr key={i.id}><td className="td font-bold">{i.name}{i.variant_name ? ` (${i.variant_name})` : ""}</td><td className="td">{formatQty(i.quantity, i)}</td><td className="td">{fcfa(i.unit_price)}{i.unit_price < i.original_unit_price && <span className="ml-1 text-xs text-promo-600 line-through">{fcfa(i.original_unit_price, false)}</span>}</td><td className="td font-bold">{fcfa(i.line_total)}</td></tr>)}</tbody>
            <tfoot className="border-t border-line text-sm"><tr><td colSpan={3} className="td text-right text-muted">Sous-total</td><td className="td font-bold">{fcfa(o.subtotal)}</td></tr><tr><td colSpan={3} className="td text-right text-muted">Livraison</td><td className="td font-bold">{fcfa(o.delivery_fee)}</td></tr>{o.discount > 0 && <tr><td colSpan={3} className="td text-right text-muted">Réduction {o.coupon_code}</td><td className="td font-bold text-promo-600">- {fcfa(o.discount)}</td></tr>}<tr><td colSpan={3} className="td text-right font-extrabold">TOTAL</td><td className="td text-lg font-black">{fcfa(o.total)}</td></tr></tfoot></table></section>
          {can(u, "orders.manage") && !["delivered", "cancelled"].includes(st) && (
            <details className="card p-5"><summary className="cursor-pointer font-extrabold text-electric-500">Modifier les informations de livraison</summary>
              <ActionForm action={updateOrderInfoAction.bind(null, o.id)} className="mt-4 grid gap-3 sm:grid-cols-2">
                <div><label className="label">Nom client</label><input name="customer_name" defaultValue={o.customer_name} className="input" /></div><div><label className="label">Téléphone livraison</label><input name="delivery_phone" defaultValue={displayPhone(o.delivery_phone ?? o.customer_phone)} className="input" /></div>
                <div><label className="label">Commune</label><input name="commune" defaultValue={o.commune ?? ""} className="input" /></div><div><label className="label">Quartier</label><input name="quartier" defaultValue={o.quartier ?? ""} className="input" /></div>
                <div className="sm:col-span-2"><label className="label">Adresse</label><input name="address_line" defaultValue={o.address_line ?? ""} className="input" /></div>
                <div><label className="label">Repère</label><input name="landmark" defaultValue={o.landmark ?? ""} className="input" /></div><div><label className="label">Instructions</label><input name="instructions" defaultValue={o.instructions ?? ""} className="input" /></div>
                <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Enregistrer</Submit></div></ActionForm></details>)}
        </div>
        <aside className="space-y-5">
          {canAct && <section className="card p-5"><h2 className="h-display mb-3 text-2xl text-navy-900">Actions</h2><OrderActions o={{ id: o.id, status: st, pickup, cod: o.payment_method === "cash_on_delivery", paid: payment?.status === "paid", driverId: delivery?.driver_id ?? null }} drivers={drivers} /></section>}
          {!pickup && o.delivery_code && <section className="card p-5 text-center"><p className="label">Code de livraison</p><p className="h-display text-4xl tracking-[0.3em] text-navy-900">{o.delivery_code}</p></section>}
          <section className="card p-5"><h2 className="h-display mb-4 text-2xl text-navy-900">Historique</h2><OrderTimeline status={st} history={history} pickup={pickup} cod={o.payment_method === "cash_on_delivery"} />
            <ul className="mt-4 space-y-1.5 border-t border-line pt-3 text-xs text-muted">{history.slice().reverse().map((h: any) => <li key={h.id}><b>{fmtDateTime(h.created_at)}</b> — {STATUS_LABEL[h.status as OrderStatus]}{h.note ? ` · ${h.note}` : ""}{h.first_name ? ` (${h.first_name})` : ""}</li>)}</ul></section>
        </aside>
      </div>
    </div>
  );
}
