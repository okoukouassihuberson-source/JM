"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "../ui/Icon";

const ITEMS: { href: string; label: string; icon: IconName }[] = [
  { href: "/mon-espace", label: "Tableau de bord", icon: "home" },
  { href: "/mon-espace/commandes", label: "Mes commandes", icon: "package" },
  { href: "/mon-espace/suivi", label: "Suivre ma commande", icon: "truck" },
  { href: "/mon-espace/adresses", label: "Mes adresses", icon: "pin" },
  { href: "/mon-espace/favoris", label: "Mes favoris", icon: "heart" },
  { href: "/mon-espace/notifications", label: "Notifications", icon: "bell" },
  { href: "/mon-espace/factures", label: "Mes factures", icon: "receipt" },
  { href: "/mon-espace/profil", label: "Mon profil", icon: "user" },
];

export function MonEspaceNav({ unread }: { unread: number }) {
  const path = usePathname();
  const on = (h: string) => (h === "/mon-espace" ? path === h : path.startsWith(h));
  return (
    <nav aria-label="Mon espace" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} aria-current={on(i.href) ? "page" : undefined}
          className={`flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${on(i.href) ? "bg-navy-900 text-white shadow-card" : "bg-white text-navy-900 hover:bg-electric-50 lg:bg-transparent"}`}>
          <Icon name={i.icon} size={18} />{i.label}
          {i.icon === "bell" && unread > 0 && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-promo-600 px-1 text-[11px] font-extrabold text-white">{unread}</span>}
        </Link>
      ))}
    </nav>
  );
}
