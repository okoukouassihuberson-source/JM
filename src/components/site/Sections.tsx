import Image from "next/image";
import Link from "next/link";
import { fmtDate } from "@/lib/format";
import { unitPrice } from "@/lib/pricing";
import type { ProductRow } from "@/lib/catalog";
import { fcfa, unitShort } from "@/lib/format";
import { Icon, type IconName } from "../ui/Icon";
import { Badge, ProductImage } from "../ui/bits";

export function SectionTitle({ eyebrow, title, href, cta, light }: { eyebrow?: string; title: string; href?: string; cta?: string; light?: boolean }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className={`mb-1 text-xs font-extrabold uppercase tracking-[0.22em] ${light ? "text-electric-300" : "text-electric-500"}`}>{eyebrow}</p>}
        <h2 className={`h-display text-4xl sm:text-5xl ${light ? "text-white" : "text-navy-900"}`}>{title}</h2>
      </div>
      {href && <Link href={href} className={`inline-flex items-center gap-1 text-sm font-extrabold ${light ? "text-electric-300" : "text-electric-500"} hover:underline`}>{cta ?? "Tout voir"} <Icon name="right" size={16} /></Link>}
    </div>
  );
}

const TRUST: { icon: IconName; title: string; text: string }[] = [
  { icon: "fish", title: "Produits frais", text: "Chaque jour" },
  { icon: "shield", title: "Qualité garantie", text: "Produits sélectionnés" },
  { icon: "wallet", title: "Meilleurs prix", text: "Le meilleur rapport qualité/prix" },
  { icon: "headset", title: "Service client", text: "À votre écoute" },
];

export function TrustBand() {
  return (
    <section aria-label="Nos engagements" className="relative z-10 mx-auto -mt-px max-w-7xl px-4">
      <ul className="card -translate-y-8 grid grid-cols-2 divide-line overflow-hidden lg:grid-cols-4 lg:divide-x">
        {TRUST.map((t, i) => (
          <li key={t.title} className={`flex animate-rise items-center gap-3 p-4 sm:p-5 ${i < 2 ? "border-b border-line lg:border-b-0" : ""} ${i % 2 === 0 ? "border-r border-line lg:border-r-0" : ""}`} style={{ animationDelay: `${i * 80}ms` }}>
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-navy-900 text-white shadow-[0_6px_16px_-6px_rgb(10_26_82/0.7)]"><Icon name={t.icon} size={22} /></span>
            <div className="min-w-0">
              <p className="text-[13px] font-extrabold uppercase leading-tight tracking-wide text-navy-900">{t.title}</p>
              <p className="text-xs leading-snug text-muted">{t.text}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PromoCard({ p, index = 0 }: { p: ProductRow; index?: number }) {
  const up = unitPrice(p);
  return (
    <article className="card group relative flex animate-rise flex-col overflow-hidden border-promo-600/20 transition hover:-translate-y-1 hover:shadow-pop" style={{ animationDelay: `${index * 70}ms` }}>
      <span className="absolute left-0 top-4 z-10 rounded-r-full bg-promo-600 px-3.5 py-1.5 text-sm font-black text-white shadow-lg">-{up.discountPct}%</span>
      <Link href={`/produits/${p.slug}`} className="relative block aspect-[4/3] overflow-hidden bg-electric-50" aria-label={p.name}>
        <ProductImage src={p.image} alt={`${p.name} en promotion`} className="transition duration-500 group-hover:scale-105" />
      </Link>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <h3 className="text-lg font-extrabold leading-tight text-navy-900">{p.name}</h3>
        <p className="text-sm font-bold text-promo-600 line-through decoration-2">{fcfa(up.original)}</p>
        <p className="flex items-baseline gap-1.5"><span className="h-display text-4xl text-navy-900" style={{ textTransform: "none" }}>{fcfa(up.price, false)}</span><span className="text-sm font-bold text-navy-900">FCFA / {unitShort(p)}</span></p>
        {p.promo_ends_at && <p className="text-xs font-semibold text-promo-600">Offre limitée — jusqu&apos;au {fmtDate(p.promo_ends_at)}</p>}
        <Link href={`/produits/${p.slug}`} className="btn-promo mt-auto">PROFITER DE L&apos;OFFRE</Link>
      </div>
    </article>
  );
}

export function Bubbles() {
  const b = [[8, 18, 14, 0], [22, 60, 9, 1.2], [38, 30, 18, 2.4], [54, 74, 8, 0.6], [70, 22, 12, 1.8], [84, 55, 16, 3], [92, 15, 7, 0.9], [14, 85, 10, 2]];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {b.map(([x, y, s, d], i) => (
        <span key={i} className="absolute animate-float rounded-full border border-white/30 bg-white/10" style={{ left: `${x}%`, top: `${y}%`, width: s * 2, height: s * 2, animationDelay: `${d}s`, animationDuration: `${6 + (i % 3) * 2}s` }} />
      ))}
    </div>
  );
}

export function Wave({ className = "", fill = "var(--color-ice)" }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className={`block h-10 w-full sm:h-16 ${className}`} aria-hidden="true">
      <path fill={fill} d="M0 64c120 28 240 40 360 28S600 36 720 40s240 44 360 48 240-14 360-40v72H0Z" />
      <path fill={fill} opacity=".5" d="M0 88c160-24 300-30 440-16s280 40 440 34 380-50 560-22v36H0Z" />
    </svg>
  );
}
