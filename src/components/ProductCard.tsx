import Link from "next/link";
import { AddToCart } from "./AddToCart";
import { FavoriteButton } from "./FavoriteButton";
import { Badge, PriceTag, ProductImage, Stars } from "./ui/bits";
import { stockLabel, type ProductRow } from "@/lib/catalog";
import { unitPrice } from "@/lib/pricing";

export function ProductCard({ p, fav = false, priority = false, index = 0 }: { p: ProductRow; fav?: boolean; priority?: boolean; index?: number }) {
  const up = unitPrice(p);
  const st = stockLabel(p);
  return (
    <article className="card group flex animate-rise flex-col overflow-hidden transition hover:-translate-y-1 hover:shadow-pop" style={{ animationDelay: `${Math.min(index, 8) * 60}ms` }}>
      <div className="relative aspect-[4/3] overflow-hidden bg-electric-50">
        <Link href={`/produits/${p.slug}`} aria-label={p.name} className="absolute inset-0">
          <ProductImage src={p.image} alt={`${p.name} frais — JM Poissonnerie`} priority={priority} className="transition duration-500 group-hover:scale-105" />
        </Link>
        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-col items-start gap-1">
          <Badge tone="blue" className="bg-white/95 shadow-sm">● Frais</Badge>
          {up.onPromo && <Badge tone="red">-{up.discountPct}%</Badge>}
        </div>
        <FavoriteButton productId={p.id} initial={fav} className="absolute right-2.5 top-2.5" />
      </div>
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-electric-500">{p.category_name}</p>
          <h3 className="line-clamp-2 min-h-[2.6rem] text-base font-extrabold leading-tight text-navy-900"><Link href={`/produits/${p.slug}`}>{p.name}</Link></h3>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
          <Stars value={p.rating} count={p.review_count} size={13} />
          <span className={`text-[11px] font-bold ${st === "out" ? "text-promo-600" : st === "low" ? "text-warning-600" : "text-success-600"}`}>
            {st === "out" ? "● Rupture" : st === "low" ? `● Plus que ${p.available} ${p.unit_label}` : "● Disponible"}
          </span>
        </div>
        <PriceTag price={up.price} original={up.onPromo ? up.original : undefined} u={p} size="md" />
        <div className="mt-auto pt-1">
          {p.has_variants ? (
            <Link href={`/produits/${p.slug}`} className="btn-outline btn-sm min-h-10 w-full">Choisir une option</Link>
          ) : (
          <AddToCart productId={p.id} unit={p.unit} unit_label={p.unit_label} step={p.step} min_qty={p.min_qty} allow_custom_qty={p.allow_custom_qty} available={p.available} compact name={p.name} />
          )}
        </div>
      </div>
    </article>
  );
}
