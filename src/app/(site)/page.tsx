import Image from "next/image";
import Link from "next/link";
import { ProductCard } from "@/components/ProductCard";
import { Bubbles, PromoCard, SectionTitle, TrustBand, Wave } from "@/components/site/Sections";
import { Icon } from "@/components/ui/Icon";
import { Stars } from "@/components/ui/bits";
import { favoriteIds, latestReviews, listCategories, listProducts } from "@/lib/catalog";
import { displayPhone, fcfa, normalizePhone, timeAgo } from "@/lib/format";
import { unitPrice } from "@/lib/pricing";
import { getSettings, whatsappUrl } from "@/lib/settings";

export default async function Home() {
  const [s, cats, featured, promos, reviews, favs] = await Promise.all([
    getSettings(), listCategories(), listProducts({ featured: true, pageSize: 8 }), listProducts({ promo: true, pageSize: 4 }), latestReviews(3), favoriteIds(),
  ]);
  const hero = promos.items[0] ?? featured.items[0];
  const hu = hero ? unitPrice(hero) : null;
  const moment = featured.items.length >= 4 ? featured.items : (await listProducts({ pageSize: 8 })).items;
  const phone = displayPhone(normalizePhone(s.contact.phone) ?? s.contact.phone);

  return (
    <>
      {/* ─────────── HERO ─────────── */}
      <section className="relative isolate overflow-hidden bg-[radial-gradient(120%_90%_at_70%_0%,#1745b8_0%,#0d2370_38%,#050d2e_100%)] text-white">
        <Bubbles />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pb-24 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32 lg:pt-16">
          <div>
            <span className="mb-5 inline-flex animate-rise items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-extrabold uppercase tracking-widest text-electric-300 backdrop-blur">
              <Icon name="fish" size={16} /> Fraîcheur · Qualité · Bon prix
            </span>
            <h1 className="animate-rise" style={{ animationDelay: "80ms" }}>
              <span className="h-display block text-[5.2rem] italic leading-[0.82] text-white drop-shadow-[0_4px_0_rgb(30_107_255/0.6)] sm:text-[7.5rem]">JM</span>
              <span className="mt-1 block font-black italic tracking-tight text-electric-400 [font-size:clamp(2.4rem,9vw,4.6rem)]" style={{ fontFamily: "var(--font-sans)", textShadow: "0 3px 24px rgb(30 107 255 / 0.5)" }}>Poissonnerie</span>
              <span className="mt-4 block text-balance text-[1.35rem] font-extrabold uppercase leading-tight tracking-wide sm:text-3xl">{s.brand.hero_title}</span>
            </h1>
            <p className="mt-4 max-w-xl animate-rise text-base text-white/80 sm:text-lg" style={{ animationDelay: "160ms" }}>{s.brand.hero_subtitle}</p>
            <div className="mt-7 flex animate-rise flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
              <Link href="/produits" className="btn-primary btn-lg">COMMANDER MAINTENANT <Icon name="right" size={20} /></Link>
              <Link href="#nos-produits" className="btn btn-lg border-2 border-white/40 text-white hover:bg-white/10">VOIR NOS PRODUITS</Link>
            </div>
            <ul className="mt-8 flex animate-rise flex-wrap gap-x-6 gap-y-2 text-sm font-semibold text-white/85" style={{ animationDelay: "320ms" }}>
              {["Produits frais chaque jour", "Livraison rapide", `Commandez au ${phone}`].map((t) => <li key={t} className="flex items-center gap-2"><Icon name="check" size={16} className="text-electric-300" />{t}</li>)}
            </ul>
          </div>
          <div className="relative mx-auto w-full max-w-md animate-rise lg:max-w-none" style={{ animationDelay: "200ms" }}>
            <div className="absolute -inset-6 rounded-[3rem] bg-electric-500/30 blur-3xl" aria-hidden="true" />
            {hero && (
              <Link href={`/produits/${hero.slug}`} className="group relative block aspect-[5/6] animate-float overflow-hidden rounded-[2rem] border-4 border-white/20 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] [animation-duration:9s] sm:aspect-[4/4.3]">
                <Image src={hero.image ?? "/images/products/carpe.webp"} alt={`${hero.name} fraîche — JM Poissonnerie`} fill priority sizes="(max-width: 1024px) 90vw, 560px" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-linear-to-t from-navy-950/80 via-transparent to-white/10" />
                <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 rounded-2xl bg-white/95 p-3.5 text-navy-900 shadow-pop backdrop-blur">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-electric-500">Prix au kilo</p>
                    <p className="text-lg font-black uppercase leading-none">{hero.name}</p>
                  </div>
                  <p className="h-display text-4xl leading-none" style={{ textTransform: "none" }}>{fcfa(hu!.price, false)}<span className="ml-1 text-sm font-bold">FCFA</span></p>
                </div>
                {hu?.onPromo && <span className="absolute right-4 top-4 grid size-16 rotate-12 place-items-center rounded-full bg-promo-600 text-center text-sm font-black leading-tight text-white shadow-xl">-{hu.discountPct}%</span>}
              </Link>
            )}
            <div className="absolute -left-3 top-8 hidden rotate-[-8deg] rounded-full border-2 border-white/60 bg-navy-900 px-4 py-3 text-center shadow-pop sm:block" aria-hidden="true">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-electric-300">Fraîcheur</p>
              <p className="h-display text-xl leading-none">Qualité<br />& bon prix</p>
            </div>
          </div>
        </div>
        <Wave className="absolute inset-x-0 bottom-0" />
      </section>

      <TrustBand />

      {/* ─────────── CATÉGORIES ─────────── */}
      <section id="nos-produits" className="mx-auto max-w-7xl scroll-mt-28 px-4 pt-2">
        <SectionTitle eyebrow="Nous vous proposons" title="Nos produits" href="/produits" cta="Tout le catalogue" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3">
          {cats.map((c, i) => (
            <Link key={c.id} href={`/produits?categorie=${c.slug}`} className="group relative flex aspect-[4/5] animate-rise flex-col justify-end overflow-hidden rounded-3xl bg-navy-900 shadow-card sm:aspect-[4/3]" style={{ animationDelay: `${i * 70}ms` }}>
              {c.image_url && <Image src={c.image_url} alt={`${c.name} — JM Poissonnerie`} fill sizes="(max-width:1024px) 50vw, 400px" className="object-cover opacity-90 transition duration-700 group-hover:scale-110" />}
              <div className="absolute inset-0 bg-linear-to-t from-navy-950 via-navy-950/40 to-transparent" />
              <div className="relative p-4 text-white sm:p-5">
                <p className="mb-1 inline-block rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-bold backdrop-blur">{c.product_count} produit{c.product_count > 1 ? "s" : ""}</p>
                <h3 className="h-display text-3xl sm:text-4xl">{c.name}</h3>
                <p className="mt-1 line-clamp-2 hidden text-sm text-white/75 sm:block">{c.description}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-electric-500 px-4 py-2 text-xs font-extrabold uppercase tracking-wide transition group-hover:bg-white group-hover:text-navy-900">Voir les produits <Icon name="right" size={14} /></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ─────────── PRODUITS DU MOMENT ─────────── */}
      <section className="mx-auto max-w-7xl px-4 pt-16">
        <SectionTitle eyebrow="Fraîchement arrivés" title="Nos produits du moment" href="/produits" />
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
          {moment.slice(0, 8).map((p, i) => <ProductCard key={p.id} p={p} fav={favs.has(p.id)} index={i} priority={i < 2} />)}
        </div>
      </section>

      {/* ─────────── PROMOTIONS ─────────── */}
      {promos.items.length > 0 && (
        <section className="mt-16 bg-linear-to-b from-promo-50 to-transparent py-12">
          <div className="mx-auto max-w-7xl px-4">
            <SectionTitle eyebrow="Offres limitées" title="Les bonnes affaires" href="/promotions" cta="Toutes les offres" />
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
              {promos.items.map((p, i) => <PromoCard key={p.id} p={p} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {/* ─────────── LIVRAISON / WHATSAPP ─────────── */}
      <section className="mx-auto mt-6 max-w-7xl px-4">
        <div className="relative overflow-hidden rounded-[2rem] bg-[radial-gradient(100%_120%_at_0%_0%,#1745b8_0%,#0a1a52_55%,#050d2e_100%)] p-6 text-white sm:p-10 lg:grid lg:grid-cols-[1.2fr_1fr] lg:items-center lg:gap-10">
          <Bubbles />
          <div className="relative">
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.22em] text-electric-300">Livraison possible</p>
            <h2 className="h-display text-4xl sm:text-6xl">Rapide, fiable<br />et sécurisée</h2>
            <p className="mt-3 max-w-lg text-white/80">Suivez votre commande de la préparation jusqu&apos;à votre porte. Notre livreur vous appelle à l&apos;approche — vous n&apos;avez qu&apos;à lui donner votre code de livraison.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href={whatsappUrl(s)} target="_blank" rel="noopener" className="btn btn-lg bg-[#25d366] text-white shadow-lg hover:bg-[#1fb957]"><Icon name="whatsapp" size={22} /> COMMANDER SUR WHATSAPP</a>
              <Link href="/livraison" className="btn btn-lg border-2 border-white/40 text-white hover:bg-white/10">Zones & tarifs</Link>
            </div>
          </div>
          <ol className="relative mt-8 grid gap-3 lg:mt-0">
            {[["Vous commandez", "En ligne ou sur WhatsApp"], ["On prépare", "Produits frais sélectionnés"], ["On vous livre", "Suivi en temps réel"]].map(([t, d], i) => (
              <li key={t} className="flex items-center gap-4 rounded-2xl bg-white/10 p-4 backdrop-blur"><span className="h-display grid size-11 place-items-center rounded-full bg-electric-500 text-2xl">{i + 1}</span><div><p className="font-extrabold">{t}</p><p className="text-sm text-white/70">{d}</p></div></li>
            ))}
          </ol>
        </div>
      </section>

      {/* ─────────── AVIS ─────────── */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pt-16">
          <SectionTitle eyebrow="Ils nous font confiance" title="Avis de nos clients" />
          <div className="grid gap-4 md:grid-cols-3">
            {reviews.map((r) => (
              <figure key={r.id} className="card flex flex-col gap-3 p-5">
                <Stars value={r.rating} size={16} />
                <blockquote className="text-[15px] leading-relaxed text-ink">« {r.comment} »</blockquote>
                <figcaption className="mt-auto flex items-center justify-between text-xs text-muted"><span className="font-bold text-navy-900">{r.first_name} {r.last_name[0]}.</span><Link href={`/produits/${r.slug}`} className="hover:text-electric-500">{r.product_name} · {timeAgo(r.created_at)}</Link></figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
