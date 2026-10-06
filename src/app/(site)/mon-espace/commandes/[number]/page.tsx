import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cancelOrderAction, submitPaymentRefAction } from "@/actions/account";
import { AutoRefresh } from "@/components/AutoRefresh";
import { LiveTracker } from "@/components/LiveTracker";
import { OrderTimeline } from "@/components/OrderTimeline";
import { PayOnline } from "@/components/PayOnline";
import { ActionButton, ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { requireUser } from "@/lib/auth";
import { displayPhone, fcfa, fmtDateTime, fmtTime, formatQty } from "@/lib/format";
import { getOrderDetail } from "@/lib/order-view";
import { ACTIVE_STATUSES, METHOD_LABEL, PAY_STATUS_LABEL, PAYMENT_LABEL, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";
import { cinetpayConfigured } from "@/lib/payments/cinetpay";
import { getSettings, whatsappUrl } from "@/lib/settings";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  return { title: `Commande ${(await params).number}` };
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ nouveau?: string }> }) {
  const { number } = await params;
  const u = await requireUser(`/mon-espace/commandes/${number}`);
  const d = await getOrderDetail(number, u.id);
  if (!d) notFound();
  const { order: o, items, payment, delivery, history, invoice } = d;
  const s = await getSettings();
  const isNew = (await searchParams).nouveau === "1";
  const st = o.status as OrderStatus;
  const active = ACTIVE_STATUSES.includes(st);
  const pickup = o.delivery_method === "pickup";
  const cod = o.payment_method === "cash_on_delivery";
  const showCode = !pickup && ["preparing", "handed_to_driver", "out_for_delivery"].includes(st) && o.delivery_code;
  const unpaid = payment && payment.status === "pending" && st !== "cancelled";

  return (
    <div className="space-y-5">
      {active && <AutoRefresh seconds={30} />}
      {isNew && (
        <div className="animate-rise rounded-2xl bg-linear-to-r from-success-600 to-emerald-500 p-5 text-white shadow-pop">
          <p className="flex items-center gap-2 text-lg font-extrabold"><Icon name="check" /> Commande confirmée, merci {u.first_name} !</p>
          <p className="mt-1 text-sm text-white/90">Votre commande {o.number} est enregistrée. {cod ? "Vous réglerez à la réception." : "Finalisez le paiement ci-dessous pour lancer la préparation."} Une facture est disponible.</p>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/mon-espace/commandes" className="text-xs font-bold text-electric-500">← Mes commandes</Link>
          <h1 className="h-display text-3xl text-navy-900 sm:text-5xl">Commande #{o.number}</h1>
          <p className="text-sm text-muted">Passée le {fmtDateTime(o.created_at)}</p>
        </div>
        <span className={`badge text-xs ${STATUS_TONE[st]}`}>{STATUS_LABEL[st]}</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          {st === "out_for_delivery" && (
            <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-pop">
              <p className="flex items-center gap-2 text-lg font-extrabold"><Icon name="truck" /> Votre commande est en cours de livraison.</p>
              {delivery?.eta && <p className="mt-1 text-sm text-white/80">Arrivée estimée vers <b className="text-white">{fmtTime(delivery.eta)}</b></p>}
            </div>
          )}
          <section className="card p-5">
            <h2 className="h-display mb-4 text-2xl text-navy-900">Suivi de commande</h2>
            <OrderTimeline status={st} history={history} pickup={pickup} cod={cod} />
          </section>

          {!pickup && (delivery?.driver_first || showCode) && (
            <section className="card space-y-4 p-5">
              <h2 className="h-display text-2xl text-navy-900">Livraison</h2>
              {delivery?.driver_first && (
                <div className="flex items-center gap-4 rounded-2xl bg-electric-50 p-4">
                  <span className="grid size-12 place-items-center rounded-full bg-navy-900 text-white"><Icon name="user" /></span>
                  <div className="min-w-0 flex-1"><p className="font-extrabold text-navy-900">{delivery.driver_first} {delivery.driver_last?.[0]}.</p><p className="text-xs text-muted">{delivery.vehicle} · {displayPhone(delivery.driver_phone)}</p></div>
                  <a href={`tel:+${delivery.driver_phone}`} className="btn-primary btn-sm"><Icon name="phone" size={16} /> Appeler</a>
                </div>
              )}
              {showCode && (
                <div className="rounded-2xl border-2 border-dashed border-electric-400 p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted">Code de livraison — à donner au livreur</p>
                  <p className="h-display mt-1 text-5xl tracking-[0.3em] text-navy-900">{o.delivery_code}</p>
                </div>
              )}
              {st === "out_for_delivery" && s.delivery.live_tracking_enabled && <LiveTracker number={o.number} initial={delivery?.last_lat != null ? { lat: delivery.last_lat, lng: delivery.last_lng, updated_at: delivery.location_updated_at } : null} />}
              <p className="flex gap-2 text-sm text-muted"><Icon name="pin" size={18} className="mt-0.5 shrink-0" /><span>{[o.address_line, o.quartier, o.commune].filter(Boolean).join(", ")}{o.landmark ? ` (${o.landmark})` : ""}</span></p>
            </section>
          )}
          {pickup && <section className="card p-5 text-sm"><h2 className="h-display mb-2 text-2xl text-navy-900">Retrait sur place</h2><p className="flex gap-2"><Icon name="pin" size={18} className="shrink-0 text-electric-500" />{[s.contact.address, s.contact.city].filter(Boolean).join(", ")}</p></section>}

          <section className="card overflow-hidden">
            <h2 className="h-display p-5 pb-3 text-2xl text-navy-900">Produits</h2>
            <ul className="divide-y divide-line">
              {items.map((i: any) => (
                <li key={i.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="min-w-0">{i.slug ? <Link href={`/produits/${i.slug}`} className="block truncate font-bold text-navy-900 hover:text-electric-500">{i.name}{i.variant_name ? ` (${i.variant_name})` : ""}</Link> : <span className="font-bold">{i.name}</span>}<span className="text-xs text-muted">{formatQty(i.quantity, i)} × {fcfa(i.unit_price)}</span></span>
                  <span className="shrink-0 font-bold">{fcfa(i.line_total)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-1.5 border-t border-line bg-electric-50/50 p-5 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="font-bold">{fcfa(o.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Livraison ({METHOD_LABEL[o.delivery_method as keyof typeof METHOD_LABEL]})</dt><dd className="font-bold">{o.delivery_fee ? fcfa(o.delivery_fee) : "Offerte"}</dd></div>
              {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Réduction {o.coupon_code && `(${o.coupon_code})`}</dt><dd className="font-bold text-promo-600">- {fcfa(o.discount)}</dd></div>}
              <div className="flex justify-between border-t border-line pt-2 text-base"><dt className="font-extrabold">TOTAL</dt><dd className="font-black">{fcfa(o.total)}</dd></div>
            </dl>
          </section>

          {st === "delivered" && (
            <section className="card p-5"><h2 className="h-display mb-2 text-2xl text-navy-900">Votre avis compte</h2><p className="mb-3 text-sm text-muted">Notez les produits reçus :</p>
              <div className="flex flex-wrap gap-2">{items.filter((i: any) => i.slug).map((i: any) => <Link key={i.id} href={`/produits/${i.slug}#avis`} className="btn-outline btn-sm"><Icon name="star" size={14} /> {i.name}</Link>)}</div></section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="card space-y-3 p-5">
            <h2 className="h-display text-2xl text-navy-900">Paiement</h2>
            <p className="flex items-center justify-between text-sm"><span className="text-muted">{PAYMENT_LABEL[o.payment_method]}</span><span className={`badge ${payment?.status === "paid" ? "bg-success-50 text-success-600" : payment?.status === "failed" ? "bg-promo-50 text-promo-600" : "bg-warning-50 text-warning-600"}`}>{PAY_STATUS_LABEL[payment?.status ?? "pending"]}</span></p>
            {unpaid && o.payment_method === "mobile_money" && (
              <div className="space-y-3 rounded-2xl bg-electric-50 p-4 text-sm">
                <p className="font-bold">Envoyez {fcfa(o.total)} à :</p><p className="whitespace-pre-line">{s.payment.mobile_money_numbers}</p>
                <ActionForm action={submitPaymentRefAction.bind(null, o.number)} className="space-y-2">
                  <label className="label" htmlFor="ref">Référence de transaction</label>
                  <input id="ref" name="reference" defaultValue={payment?.reference ?? ""} className="input" maxLength={40} required />
                  <Submit className="btn-primary btn-sm w-full">Envoyer la référence</Submit>
                </ActionForm>
              </div>
            )}
            {unpaid && o.payment_method === "online" && cinetpayConfigured() && <PayOnline number={o.number} />}
          </section>
          <section className="card space-y-2 p-5">
            <h2 className="h-display text-2xl text-navy-900">Actions</h2>
            {invoice && <a href={`/api/invoices/${o.number}`} className="btn-outline w-full"><Icon name="download" size={18} /> Facture {invoice.number} (PDF)</a>}
            <a href={whatsappUrl(s, `Bonjour, une question sur ma commande ${o.number}.`)} target="_blank" rel="noopener" className="btn-outline w-full"><Icon name="whatsapp" size={18} /> Une question ?</a>
            {["received", "payment_confirmed"].includes(st) && <ActionButton action={cancelOrderAction} args={[o.number]} className="btn-danger w-full" confirm="Annuler cette commande ?">Annuler la commande</ActionButton>}
          </section>
        </aside>
      </div>
    </div>
  );
}
