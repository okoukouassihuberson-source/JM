import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, type IconName } from "@/components/ui/Icon";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "À propos — JM Poissonnerie", description: "JM Poissonnerie : poisson frais, carpes, poulet, rognons et tripes sélectionnés chaque jour, au meilleur prix, avec livraison rapide." };

const VALUES: { i: IconName; t: string; d: string }[] = [
  { i: "fish", t: "Fraîcheur", d: "Des produits approvisionnés et conservés sur glace, vendus au plus frais." },
  { i: "shield", t: "Qualité", d: "Chaque produit est sélectionné et contrôlé avant d'être préparé pour vous." },
  { i: "heart", t: "Confiance", d: "Un service client à l'écoute et une hygiène irréprochable, chaque jour." },
  { i: "wallet", t: "Bon prix", d: "Le meilleur rapport qualité/prix, affiché clairement au kilo." },
];

export default async function About() {
  const s = await getSettings();
  return (
    <div>
      <section className="bg-navy-900 py-14 text-white"><div className="mx-auto max-w-7xl px-4"><p className="mb-1 text-xs font-extrabold uppercase tracking-[0.22em] text-electric-300">À propos</p>
        <h1 className="h-display text-5xl sm:text-7xl">{s.brand.slogan}</h1><p className="mt-4 max-w-2xl text-lg text-white/80">{s.brand.name} est votre poissonnerie de quartier, désormais accessible en ligne : commandez, suivez votre livraison et réglez comme vous le souhaitez.</p></div></section>
      <div className="mx-auto max-w-7xl space-y-14 px-4 py-12">
        <div className="grid items-center gap-8 lg:grid-cols-2">
          <div className="space-y-4 text-ink/90">
            <h2 className="h-display text-4xl text-navy-900">Ce que nous proposons</h2>
            <p>Poissons frais, carpes, poulet, rognons, tripes, tête de porc, crevettes et bien d&apos;autres produits frais : notre catalogue évolue selon les arrivages et les saisons, avec des prix affichés au kilo, à la pièce ou au plateau.</p>
            <p>Installés au <b>{s.contact.address}</b>{s.contact.city ? ` (${s.contact.city})` : ""}, nous servons les particuliers comme les professionnels, sur place ou en livraison.</p>
            <div className="flex flex-wrap gap-3 pt-2"><Link href="/produits" className="btn-primary">Voir nos produits</Link><Link href="/livraison" className="btn-outline">Zones de livraison</Link></div>
          </div>
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl shadow-pop"><Image src="/images/categories/fruits-de-mer.webp" alt="Poissons, crevettes et saumon frais sur glace" fill sizes="(max-width:1024px) 100vw, 560px" className="object-cover" /></div>
        </div>
        <div><h2 className="h-display mb-6 text-4xl text-navy-900">Nos engagements</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{VALUES.map((v) => <div key={v.t} className="card p-5"><span className="mb-3 grid size-12 place-items-center rounded-2xl bg-navy-900 text-white"><Icon name={v.i} /></span><h3 className="text-lg font-extrabold text-navy-900">{v.t}</h3><p className="mt-1 text-sm text-muted">{v.d}</p></div>)}</div></div>
      </div>
    </div>
  );
}
