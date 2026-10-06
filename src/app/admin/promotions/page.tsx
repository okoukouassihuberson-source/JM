import type { Metadata } from "next";
import Image from "next/image";
import { broadcastPromoAction, deleteCouponAction, saveCouponAction, setPromoAction, stopPromoAction, toggleCouponAction } from "@/actions/admin-catalog";
import { ActionButton, ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/bits";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";
import { fcfa, fmtDate } from "@/lib/format";
import { promoLive } from "@/lib/pricing";

export const metadata: Metadata = { title: "Promotions" };

export default async function Promotions() {
  await requirePage("promotions.manage", "/admin/promotions");
  const [products, coupons] = await Promise.all([
    query<any>("select p.id, p.name, p.price, p.promo_price, p.promo_active, p.promo_ends_at, p.unit_label, (select url from product_images i where i.product_id = p.id order by position limit 1) as image from products p where p.active order by p.promo_active desc, p.name"),
    query<any>("select * from coupons order by created_at desc"),
  ]);
  const live = products.filter((p) => promoLive(p));
  return (
    <div className="space-y-8">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-promo-600">Le rouge est réservé aux bonnes affaires</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Promotions</h1></div>
      <section className="space-y-3"><h2 className="h-display text-3xl text-navy-900">Prix promotionnels ({live.length} actif{live.length > 1 ? "s" : ""})</h2>
        <div className="grid gap-3 lg:grid-cols-2">{products.map((p) => {
          const on = promoLive(p);
          return (
            <article key={p.id} className={`card flex flex-col gap-3 p-4 ${on ? "border-promo-600/30 bg-promo-50/30" : ""}`}>
              <div className="flex items-center gap-3"><span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-electric-50">{p.image && <Image src={p.image} alt="" fill sizes="56px" className="object-cover" />}</span>
                <div className="min-w-0 flex-1"><h3 className="truncate font-extrabold text-navy-900">{p.name}</h3><p className="text-sm text-muted">Prix normal : <b>{fcfa(p.price)}</b>/{p.unit_label}</p>{on && <p className="text-sm font-bold text-promo-600">Promo : {fcfa(p.promo_price)} (-{Math.round((1 - p.promo_price / p.price) * 100)}%){p.promo_ends_at && ` · jusqu'au ${fmtDate(p.promo_ends_at)}`}</p>}</div>
                {on && <div className="flex flex-col gap-1"><ActionButton action={stopPromoAction} args={[p.id]} className="btn-outline btn-sm">Désactiver</ActionButton><ActionButton action={broadcastPromoAction} args={[p.id]} className="btn-promo btn-sm" confirm="Notifier tous les clients de cette promotion ?">Notifier</ActionButton></div>}</div>
              <ActionForm action={setPromoAction.bind(null, p.id)} className="flex flex-wrap items-end gap-2">
                <div><label className="label">Prix promo</label><input name="promo_price" type="number" min={0} step={5} defaultValue={p.promo_price ?? ""} required className="input !min-h-10 w-28" /></div>
                <div><label className="label">Jusqu&apos;au</label><input name="promo_ends_at" type="date" defaultValue={p.promo_ends_at ? new Date(p.promo_ends_at).toISOString().slice(0, 10) : ""} className="input !min-h-10 w-40" /></div>
                <Submit className="btn-promo btn-sm">{on ? "Mettre à jour" : "Activer l'offre"}</Submit></ActionForm>
            </article>);
        })}</div></section>
      <section className="space-y-3"><h2 className="h-display text-3xl text-navy-900">Codes promo</h2>
        <details className="card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Nouveau code</summary>
          <ActionForm action={saveCouponAction.bind(null, null)} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6" reset>
            <div><label className="label">Code</label><input name="code" required className="input uppercase" /></div>
            <div><label className="label">Type</label><select name="type" className="input"><option value="percent">Pourcentage</option><option value="fixed">Montant fixe</option></select></div>
            <div><label className="label">Valeur</label><input name="value" type="number" min={1} required className="input" /></div>
            <div><label className="label">Commande min.</label><input name="min_order" type="number" min={0} defaultValue={0} className="input" /></div>
            <div><label className="label">Utilisations max</label><input name="max_uses" type="number" min={1} className="input" /></div>
            <div><label className="label">Expire le</label><input name="expires_at" type="date" className="input" /></div>
            <div className="sm:col-span-3 lg:col-span-6"><Submit className="btn-primary btn-sm">Créer</Submit></div></ActionForm></details>
        <div className="card overflow-x-auto"><table className="w-full min-w-[700px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Code", "Remise", "Min.", "Utilisé", "Expire", "Statut", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{coupons.map((c) => <tr key={c.id}><td className="td font-black tracking-wider">{c.code}</td><td className="td font-bold text-promo-600">{c.type === "percent" ? `-${c.value}%` : `-${fcfa(c.value)}`}</td><td className="td">{c.min_order ? fcfa(c.min_order) : "—"}</td><td className="td">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ""}</td><td className="td">{c.expires_at ? fmtDate(c.expires_at) : "—"}</td><td className="td">{c.active ? <Badge tone="green">Actif</Badge> : <Badge tone="gray">Inactif</Badge>}</td>
            <td className="td text-right"><div className="flex justify-end gap-1"><ActionButton action={toggleCouponAction} args={[c.id]} className="btn-outline btn-sm">{c.active ? "Désactiver" : "Activer"}</ActionButton><ActionButton action={deleteCouponAction} args={[c.id]} confirm="Supprimer ce code ?" className="btn-danger btn-sm"><Icon name="trash" size={14} /></ActionButton></div></td></tr>)}
            {coupons.length === 0 && <tr><td colSpan={7} className="td py-8 text-center text-muted">Aucun code promo.</td></tr>}</tbody></table></div></section>
    </div>
  );
}
