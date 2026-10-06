import type { Metadata } from "next";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Icon } from "@/components/ui/Icon";
import { Empty, PageTitle, Pagination } from "@/components/ui/bits";
import { favoriteIds, listCategories, listProducts } from "@/lib/catalog";

const SIZE = 12;
type SP = { q?: string; categorie?: string; tri?: string; promo?: string; page?: string; focus?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  const cats = await listCategories();
  const c = cats.find((x) => x.slug === sp.categorie);
  return {
    title: c ? `${c.name} frais — prix au kilo et livraison` : "Nos produits frais : poissons, carpes, poulet, rognons, tripes",
    description: c ? `${c.description} Commandez en ligne ${c.name.toLowerCase()} frais, livraison rapide chez JM Poissonnerie.` : "Poisson frais, carpes, poulet, rognons, tripes et plus : commandez en ligne, livraison rapide et meilleurs prix.",
    alternates: { canonical: c ? `/produits?categorie=${c.slug}` : "/produits" },
    robots: sp.q || sp.page ? { index: false, follow: true } : undefined,
  };
}

export default async function Catalogue({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const q = sp.q?.trim().slice(0, 60);
  const [cats, { items, total }, favs] = await Promise.all([
    listCategories(), listProducts({ q, category: sp.categorie, sort: sp.tri, promo: sp.promo === "1", page, pageSize: SIZE }), favoriteIds(),
  ]);
  const pages = Math.ceil(total / SIZE);
  const url = (o: Partial<SP>) => {
    const p = new URLSearchParams();
    const m = { ...sp, ...o, focus: undefined };
    for (const [k, v] of Object.entries(m)) if (v) p.set(k, String(v));
    const s = p.toString();
    return `/produits${s ? `?${s}` : ""}`;
  };
  const current = cats.find((c) => c.slug === sp.categorie);
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageTitle eyebrow={q ? `Résultats pour « ${q} »` : "Catalogue"} title={current?.name ?? "Tous nos produits"}>
        <p className="text-sm font-semibold text-muted">{total} produit{total > 1 ? "s" : ""}</p>
      </PageTitle>

      <form action="/produits" role="search" className="mb-5 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        {sp.categorie && <input type="hidden" name="categorie" value={sp.categorie} />}
        <div className="relative">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={q} autoFocus={sp.focus === "1"} type="search" placeholder="Rechercher : carpe, poulet, rognon…" aria-label="Rechercher" className="input !pl-10" />
        </div>
        <select name="tri" defaultValue={sp.tri ?? ""} aria-label="Trier" className="input sm:w-52">
          <option value="">Trier : Pertinence</option><option value="prix_asc">Prix croissant</option><option value="prix_desc">Prix décroissant</option><option value="note">Mieux notés</option><option value="nom">Nom (A-Z)</option>
        </select>
        <button className="btn-navy">Rechercher</button>
      </form>

      <div className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none]" aria-label="Catégories">
        {[{ slug: "", name: "Tout", product_count: null as number | null }, ...cats].map((c) => {
          const on = (sp.categorie ?? "") === c.slug;
          return <Link key={c.slug} href={url({ categorie: c.slug || undefined, page: undefined })} aria-current={on ? "true" : undefined}
            className={`btn btn-sm shrink-0 !rounded-full border-2 ${on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white text-navy-900 hover:border-electric-400"}`}>{c.name}{c.product_count != null && <span className="opacity-60">{c.product_count}</span>}</Link>;
        })}
        <Link href={url({ promo: sp.promo === "1" ? undefined : "1", page: undefined })} className={`btn btn-sm shrink-0 !rounded-full border-2 ${sp.promo === "1" ? "border-promo-600 bg-promo-600 text-white" : "border-promo-600/30 bg-white text-promo-600"}`}><Icon name="percent" size={14} /> Promotions</Link>
      </div>

      {items.length === 0 ? (
        <Empty icon="search" title="Aucun produit trouvé" text="Essayez un autre mot-clé ou parcourez toutes les catégories." href="/produits" cta="Voir tous les produits" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">
          {items.map((p, i) => <ProductCard key={p.id} p={p} fav={favs.has(p.id)} index={i} priority={i < 4} />)}
        </div>
      )}
      <Pagination page={page} pages={pages} href={(n) => url({ page: String(n) })} />
    </div>
  );
}
