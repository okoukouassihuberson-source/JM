import Image from "next/image";
import Link from "next/link";
import { Icon, StarFill } from "./Icon";
import { fcfa, unitShort, type UnitInfo } from "@/lib/format";

export function Logo({ className = "h-11 w-auto", priority = false, src = "/images/brand/logo.webp" }: { className?: string; priority?: boolean; src?: string }) {
  return <Image src={src} alt="JM Poissonnerie et livraison" width={1280} height={512} className={className} priority={priority} sizes="160px" />;
}

export function ProductImage({ src, alt, sizes = "(max-width: 640px) 50vw, 25vw", className = "", priority = false }: { src: string | null; alt: string; sizes?: string; className?: string; priority?: boolean }) {
  if (!src) return (
    <div className={`grid place-items-center bg-linear-to-br from-electric-50 to-electric-100 text-electric-400 ${className}`}><Icon name="fish" size={48} /></div>
  );
  return <Image src={src} alt={alt} fill sizes={sizes} className={`object-cover ${className}`} priority={priority} quality={75} />;
}

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Note ${value} sur 5`}>
      <span className="flex">{[1, 2, 3, 4, 5].map((i) => <StarFill key={i} size={size} className={i <= Math.round(value) ? "text-amber-400" : "text-slate-200"} />)}</span>
      {count != null && <span className="text-xs text-muted">{count > 0 ? `(${count})` : "Nouveau"}</span>}
    </span>
  );
}

export function PriceTag({ price, original, u, size = "md" }: { price: number; original?: number; u: UnitInfo; size?: "sm" | "md" | "lg" }) {
  const big = { sm: "text-xl", md: "text-2xl", lg: "text-4xl" }[size];
  return (
    <div className="flex flex-wrap items-baseline gap-x-2">
      <span className={`h-display ${big} text-navy-900`} style={{ textTransform: "none" }}>{fcfa(price, false)}<span className="ml-1 text-[0.5em] font-bold text-navy-700">FCFA</span></span>
      <span className="text-xs font-bold text-muted">/ {unitShort(u)}</span>
      {original != null && original > price && <span className="text-sm font-semibold text-promo-600 line-through decoration-2">{fcfa(original, false)}</span>}
    </div>
  );
}

export function Badge({ children, tone = "blue", className = "" }: { children: React.ReactNode; tone?: "blue" | "red" | "green" | "orange" | "navy" | "gray"; className?: string }) {
  const t = { blue: "bg-electric-100 text-navy-700", red: "bg-promo-600 text-white", green: "bg-success-50 text-success-600", orange: "bg-warning-50 text-warning-600", navy: "bg-navy-900 text-white", gray: "bg-slate-100 text-slate-600" }[tone];
  return <span className={`badge ${t} ${className}`}>{children}</span>;
}

export function Empty({ icon = "fish", title, text, href, cta }: { icon?: any; title: string; text?: string; href?: string; cta?: string }) {
  return (
    <div className="card grid place-items-center gap-3 px-6 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-electric-50 text-electric-500"><Icon name={icon} size={30} /></span>
      <h3 className="text-lg font-extrabold text-navy-900">{title}</h3>
      {text && <p className="max-w-sm text-sm text-muted">{text}</p>}
      {href && <Link href={href} className="btn-primary mt-1">{cta}</Link>}
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow?: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow && <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">{eyebrow}</p>}
        <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function Pagination({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Pagination">
      {page > 1 && <Link href={href(page - 1)} className="btn-outline btn-sm" aria-label="Page précédente"><Icon name="left" size={16} /></Link>}
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1.5">
          {i > 0 && nums[i - 1] !== n - 1 && <span className="text-muted">…</span>}
          <Link href={href(n)} aria-current={n === page ? "page" : undefined} className={`btn btn-sm min-w-9 ${n === page ? "bg-navy-900 text-white" : "border-2 border-line bg-white text-navy-900"}`}>{n}</Link>
        </span>
      ))}
      {page < pages && <Link href={href(page + 1)} className="btn-outline btn-sm" aria-label="Page suivante"><Icon name="right" size={16} /></Link>}
    </nav>
  );
}
