import Link from "next/link";
import { logoutAction } from "@/actions/auth";
import { can, getUser, landingFor } from "@/lib/auth";
import { cartCount } from "@/lib/cart";
import { listCategories } from "@/lib/catalog";
import { displayPhone, normalizePhone } from "@/lib/format";
import { getSettings, whatsappUrl } from "@/lib/settings";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/bits";
import { MobileMenu } from "./MobileMenu";

export const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/produits", label: "Produits" },
  { href: "/promotions", label: "Promotions" },
  { href: "/a-propos", label: "À propos" },
  { href: "/livraison", label: "Livraison" },
  { href: "/contact", label: "Contact" },
];

export async function Header() {
  const [user, count, s, cats] = await Promise.all([getUser(), cartCount(), getSettings(), listCategories()]);
  const phone = displayPhone(normalizePhone(s.contact.phone) ?? s.contact.phone);
  return (
    <header className="sticky top-0 z-40 bg-white/95 shadow-[0_1px_0_var(--color-line)] backdrop-blur">
      <div className="bg-navy-900 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs font-semibold">
          <span className="flex items-center gap-2"><Icon name="truck" size={15} className="text-electric-300" /> Livraison possible — rapide, fiable et sécurisée</span>
          <a href={whatsappUrl(s)} className="hidden items-center gap-1.5 hover:text-electric-300 sm:flex" target="_blank" rel="noopener"><Icon name="whatsapp" size={15} /> Commandez au {phone}</a>
        </div>
      </div>
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 lg:gap-6">
        <MobileMenu user={user ? { name: user.first_name, home: landingFor(user) } : null} categories={cats.map((c) => ({ slug: c.slug, name: c.name }))} nav={NAV} logout={logoutAction} />
        <Link href="/" aria-label="JM Poissonnerie — accueil" className="shrink-0"><Logo className="h-11 w-auto lg:h-14" priority src={s.brand.logo_url} /></Link>
        <nav className="ml-2 hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {NAV.slice(0, 2).map((n) => <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-bold text-navy-900 transition hover:bg-electric-50 hover:text-electric-500">{n.label}</Link>)}
          <details className="group relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 text-sm font-bold text-navy-900 transition hover:bg-electric-50 hover:text-electric-500 [&::-webkit-details-marker]:hidden">Catégories <Icon name="down" size={15} className="transition group-open:rotate-180" /></summary>
            <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-2xl border border-line bg-white p-2 shadow-pop">
              {cats.map((c) => <Link key={c.slug} href={`/produits?categorie=${c.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-navy-900 hover:bg-electric-50">{c.name}<span className="text-xs text-muted">{c.product_count}</span></Link>)}
            </div>
          </details>
          {NAV.slice(2).map((n) => <Link key={n.href} href={n.href} className={`rounded-lg px-3 py-2 text-sm font-bold transition hover:bg-electric-50 ${n.href === "/promotions" ? "text-promo-600" : "text-navy-900 hover:text-electric-500"}`}>{n.label}</Link>)}
        </nav>
        <form action="/produits" role="search" className="relative ml-auto hidden max-w-xs flex-1 md:block">
          <Icon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input name="q" type="search" placeholder="Rechercher un produit…" aria-label="Rechercher un produit" className="input !min-h-10 rounded-full !pl-10" />
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link href="/produits?focus=1" className="grid size-11 place-items-center rounded-full text-navy-900 hover:bg-electric-50 md:hidden" aria-label="Rechercher"><Icon name="search" /></Link>
          <Link href="/mon-espace/favoris" className="hidden size-11 place-items-center rounded-full text-navy-900 hover:bg-electric-50 sm:grid" aria-label="Mes favoris"><Icon name="heart" /></Link>
          {user ? (
            <Link href={landingFor(user)} className="hidden items-center gap-2 rounded-full px-2 py-1.5 text-sm font-bold text-navy-900 hover:bg-electric-50 sm:flex" aria-label="Mon compte">
              <span className="grid size-8 place-items-center rounded-full bg-navy-900 text-xs font-extrabold text-white">{user.first_name[0]}{user.last_name[0]}</span>
              <span className="hidden xl:block">{can(user, "dashboard.view") ? "Espace gérant" : user.first_name}</span>
            </Link>
          ) : (
            <Link href="/connexion" className="btn-ghost btn-sm hidden sm:inline-flex"><Icon name="user" size={18} /> Connexion</Link>
          )}
          <Link href="/panier" className="relative grid size-11 place-items-center rounded-full bg-electric-50 text-navy-900 hover:bg-electric-100" aria-label={`Panier, ${count} article${count > 1 ? "s" : ""}`}>
            <Icon name="cart" />
            {count > 0 && <span key={count} className="absolute -right-1 -top-1 grid min-w-5 animate-pulse-ring place-items-center rounded-full bg-promo-600 px-1 text-[11px] font-extrabold text-white">{count}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}
