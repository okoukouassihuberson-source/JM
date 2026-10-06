import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { query } from "@/db";
import { fcfa } from "@/lib/format";
import { getSettings, whatsappUrl } from "@/lib/settings";

export const metadata: Metadata = { title: "Livraison de poisson frais — zones, tarifs et délais", description: "Livraison rapide, fiable et sécurisée de poisson frais, carpes, poulet, rognons et tripes. Découvrez nos zones, tarifs, délais et le suivi de commande en direct." };

export default async function Livraison() {
  const [s, zones] = await Promise.all([getSettings(), query<any>("select * from delivery_zones where active order by sort_order, fee")]);
  const steps = [["Commandez", "Sur le site ou sur WhatsApp, à toute heure."], ["On prépare", "Vos produits frais sont pesés et emballés avec de la glace."], ["Le livreur part", "Vous suivez chaque étape et recevez un code de livraison."], ["Vous réceptionnez", "Donnez le code au livreur et réglez si besoin."]];
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Livraison possible</p>
      <h1 className="h-display text-5xl text-navy-900 sm:text-6xl">Rapide, fiable et sécurisée</h1>
      <ol className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{steps.map(([t, d], i) => <li key={t} className="card p-5"><span className="h-display grid size-10 place-items-center rounded-full bg-electric-500 text-xl text-white">{i + 1}</span><h3 className="mt-3 font-extrabold text-navy-900">{t}</h3><p className="text-sm text-muted">{d}</p></li>)}</ol>
      <h2 className="h-display mb-4 mt-12 text-4xl text-navy-900">Zones & tarifs</h2>
      <div className="grid gap-4 md:grid-cols-3">{zones.map((z: any) => (
        <article key={z.id} className="card p-5"><h3 className="text-lg font-extrabold text-navy-900">{z.name}</h3><p className="mt-1 text-sm text-muted">{z.description}</p>
          <p className="h-display mt-3 text-4xl text-electric-500" style={{ textTransform: "none" }}>{fcfa(z.fee)}</p><p className="flex items-center gap-1.5 text-sm font-semibold"><Icon name="clock" size={16} /> {z.eta_min}–{z.eta_max} min</p></article>))}</div>
      <ul className="mt-6 grid gap-2 text-sm text-ink/90 sm:grid-cols-2">
        {s.delivery.express_enabled && <li className="flex gap-2"><Icon name="nav" size={18} className="text-electric-500" /> Livraison express : +{fcfa(s.delivery.express_supplement)}, traitement prioritaire.</li>}
        {s.delivery.pickup_enabled && <li className="flex gap-2"><Icon name="pin" size={18} className="text-electric-500" /> Retrait gratuit sur place : {s.contact.address}.</li>}
        {s.delivery.free_delivery_threshold > 0 && <li className="flex gap-2"><Icon name="wallet" size={18} className="text-electric-500" /> Livraison standard offerte dès {fcfa(s.delivery.free_delivery_threshold)} d&apos;achat.</li>}
        <li className="flex gap-2"><Icon name="lock" size={18} className="text-electric-500" /> Paiement : espèces à la livraison, Mobile Money{s.payment.cinetpay ? ", paiement en ligne" : ""}.</li>
      </ul>
      <div className="mt-10 flex flex-wrap gap-3"><Link href="/produits" className="btn-primary btn-lg">Commander maintenant</Link><a href={whatsappUrl(s)} target="_blank" rel="noopener" className="btn btn-lg bg-[#25d366] text-white"><Icon name="whatsapp" /> COMMANDER SUR WHATSAPP</a></div>
    </div>
  );
}
