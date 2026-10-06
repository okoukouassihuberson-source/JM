import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { submitReviewAction } from "@/actions/account";
import { FavoriteButton } from "@/components/FavoriteButton";
import { ProductBuy } from "@/components/ProductBuy";
import { ProductCard } from "@/components/ProductCard";
import { Gallery } from "@/components/site/Gallery";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge, Stars } from "@/components/ui/bits";
import { getUser } from "@/lib/auth";
import { favoriteIds, getProduct, listProducts, stockLabel } from "@/lib/catalog";
import { query } from "@/db";
import { fmtDate, num } from "@/lib/format";
import { reviewableOrder } from "@/lib/orders";
import { unitPrice } from "@/lib/pricing";
import { getSettings } from "@/lib/settings";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) return {};
  const up = unitPrice(p);
  return {
    title: `${p.name} frais — ${up.price} FCFA/${p.unit === "kg" ? "kg" : p.unit_label}`,
    description: `${p.description.slice(0, 140)} Commandez ${p.name.toLowerCase()} en ligne chez JM Poissonnerie — livraison rapide.`,
    alternates: { canonical: `/produits/${p.slug}` },
    openGraph: { images: p.images[0] ? [{ url: p.images[0].url, alt: p.name }] : undefined, type: "website" },
  };
}

export default async function ProductPage({ params }: Params) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const user = await getUser();
  const [s, favs, reviews, related, zone, eligible] = await Promise.all([
    getSettings(), favoriteIds(),
    query<any>("select r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name from reviews r join users u on u.id = r.user_id where r.product_id = $1 and r.status = 'published' order by r.created_at desc limit 20", [p.id]),
    listProducts({ category: p.category_slug, pageSize: 5 }),
    query<{ fee: number }>("select min(fee)::int as fee from delivery_zones where active"),
    user ? reviewableOrder(user.id, p.id) : null,
  ]);
  const st = stockLabel(p), up = unitPrice(p);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const ld = {
    "@context": "https://schema.org", "@type": "Product", name: p.name, description: p.description,
    image: p.images.map((i) => site + i.url), brand: { "@type": "Brand", name: s.brand.name }, category: p.category_name,
    ...(p.review_count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.review_count } } : {}),
    offers: { "@type": "Offer", priceCurrency: "XOF", price: up.price, availability: st === "out" ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `${site}/produits/${p.slug}`, seller: { "@type": "Organization", name: s.brand.name } },
  };
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 lg:py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav aria-label="Fil d'Ariane" className="mb-5 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
        <Link href="/" className="hover:text-electric-500">Accueil</Link><Icon name="right" size={12} />
        <Link href="/produits" className="hover:text-electric-500">Produits</Link><Icon name="right" size={12} />
        <Link href={`/produits?categorie=${p.category_slug}`} className="hover:text-electric-500">{p.category_name}</Link><Icon name="right" size={12} />
        <span className="text-navy-900">{p.name}</span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
        <Gallery images={p.images} name={p.name} badge={up.onPromo ? `-${up.discountPct}%` : undefined} />
        <div className="space-y-5">
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <Badge tone="blue">● Frais</Badge>
              <Badge tone={st === "out" ? "red" : st === "low" ? "orange" : "green"}>{st === "out" ? "Rupture de stock" : st === "low" ? `Plus que ${num(p.available)} ${p.unit_label}` : "Disponible aujourd'hui"}</Badge>
            </div>
            <div className="flex items-start justify-between gap-3">
              <h1 className="h-display text-4xl text-navy-900 sm:text-6xl">{p.name}</h1>
              <FavoriteButton productId={p.id} initial={favs.has(p.id)} className="shrink-0 border border-line" />
            </div>
            <div className="mt-2"><Stars value={p.rating} count={p.review_count} size={18} /></div>
          </div>
          <ul className="grid gap-1.5 text-sm font-semibold text-navy-900">
            {["Produit frais", "Qualité contrôlée", st === "out" ? "Bientôt de nouveau disponible" : "Disponible aujourd'hui"].map((t) => <li key={t} className="flex items-center gap-2"><span className="grid size-5 place-items-center rounded-full bg-success-50 text-success-600"><Icon name="check" size={13} /></span>{t}</li>)}
          </ul>
          <ProductBuy id={p.id} name={p.name} price={p.price} promo_price={p.promo_price} promo_active={p.promo_active} promo_ends_at={p.promo_ends_at}
            unit={p.unit} unit_label={p.unit_label} step={p.step} min_qty={p.min_qty} allow_custom_qty={p.allow_custom_qty} available={p.available}
            variants={p.variants} minZoneFee={zone[0]?.fee ?? null} />
          <div className="flex items-start gap-3 rounded-2xl bg-electric-50 p-4 text-sm"><Icon name="truck" className="mt-0.5 shrink-0 text-electric-500" /><p><b className="text-navy-900">Livraison rapide, fiable et sécurisée.</b> Suivez votre commande en direct depuis votre espace client.</p></div>
        </div>
      </div>

      <section className="mt-12 grid gap-8 lg:grid-cols-[1.3fr_1fr]">
        <div>
          <h2 className="h-display mb-3 text-3xl text-navy-900">Description</h2>
          <p className="max-w-prose whitespace-pre-line leading-relaxed text-ink/90">{p.description}</p>
          <p className="mt-4 text-sm text-muted">Catégorie : <Link className="font-bold text-electric-500" href={`/produits?categorie=${p.category_slug}`}>{p.category_name}</Link> · Unité de vente : {p.unit === "kg" ? "au kilogramme (à partir de 500 g)" : p.unit_label}</p>
        </div>
        <div>
          <h2 className="h-display mb-3 text-3xl text-navy-900">Avis clients</h2>
          {eligible && (
            <ActionForm action={submitReviewAction.bind(null, p.id, eligible)} className="card mb-4 space-y-3 p-4" reset>
              <p className="text-sm font-bold text-navy-900">Vous avez reçu ce produit : donnez votre avis</p>
              <div className="flex flex-row-reverse justify-end gap-1 [&>label:hover~label]:text-amber-400">
                {[5, 4, 3, 2, 1].map((n) => (<span key={n} className="contents"><input id={`r${n}`} type="radio" name="rating" value={n} defaultChecked={n === 5} className="peer sr-only" /><label htmlFor={`r${n}`} className="cursor-pointer text-slate-300 transition peer-checked:text-amber-400 [&:has(~input:checked)]:text-amber-400 hover:text-amber-400" title={`${n} étoile${n > 1 ? "s" : ""}`}><Icon name="star" size={28} className="fill-current" /></label></span>))}
              </div>
              <textarea name="comment" rows={3} maxLength={600} placeholder="Votre commentaire (fraîcheur, goût, livraison…)" className="input" />
              <Submit className="btn-primary btn-sm">Publier mon avis</Submit>
            </ActionForm>
          )}
          {reviews.length === 0 ? <p className="text-sm text-muted">Pas encore d&apos;avis. Les clients ayant reçu ce produit peuvent le noter après livraison.</p> : (
            <ul className="space-y-3">
              {reviews.map((r) => (
                <li key={r.id} className="card p-4">
                  <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted">{fmtDate(r.created_at)}</span></div>
                  {r.comment && <p className="mt-1.5 text-sm">{r.comment}</p>}
                  <p className="mt-1 text-xs font-bold text-navy-900">{r.first_name} {r.last_name[0]}.</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {related.items.filter((r) => r.id !== p.id).length > 0 && (
        <section className="mt-14">
          <h2 className="h-display mb-5 text-3xl text-navy-900 sm:text-4xl">Dans la même catégorie</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
            {related.items.filter((r) => r.id !== p.id).slice(0, 4).map((r, i) => <ProductCard key={r.id} p={r} fav={favs.has(r.id)} index={i} />)}
          </div>
        </section>
      )}
    </div>
  );
}
