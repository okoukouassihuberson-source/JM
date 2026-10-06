"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Accueil", icon: "home" },
  { href: "/produits", label: "Produits", icon: "grid" },
  { href: "/panier", label: "Panier", icon: "cart" },
  { href: "/mon-espace/commandes", label: "Commandes", icon: "package" },
  { href: "/mon-espace", label: "Compte", icon: "user" },
];

export function BottomNav({ count }: { count: number }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : h === "/mon-espace" ? path === "/mon-espace" : path.startsWith(h));
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Navigation mobile">
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} aria-current={active(i.href) ? "page" : undefined} className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition ${active(i.href) ? "text-electric-500" : "text-navy-900/70"}`}>
              <span className="relative">
                <Icon name={i.icon} size={23} />
                {i.icon === "cart" && count > 0 && <span className="absolute -right-2.5 -top-2 grid min-w-4.5 place-items-center rounded-full bg-promo-600 px-1 text-[10px] font-extrabold text-white">{count}</span>}
              </span>
              {i.label}
              {active(i.href) && <span className="absolute top-0 h-1 w-8 rounded-b-full bg-electric-500" />}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
