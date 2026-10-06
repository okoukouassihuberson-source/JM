"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "../ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

export function AdminNav({ items, user, logout }: { items: NavItem[]; user: { name: string; role: string }; logout: () => Promise<void> }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const on = (h: string) => (h === "/admin" ? path === h : path.startsWith(h));
  const list = (
    <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-3" aria-label="Administration">
      {items.map((i) => (
        <Link key={i.href} href={i.href} aria-current={on(i.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${on(i.href) ? "bg-electric-500 text-white shadow-[0_8px_20px_-8px_rgb(30_107_255/0.8)]" : "text-white/75 hover:bg-white/10 hover:text-white"}`}>
          <Icon name={i.icon} size={18} />{i.label}
          {!!i.badge && <span className="ml-auto grid min-w-5 place-items-center rounded-full bg-promo-600 px-1.5 text-[11px] font-extrabold text-white">{i.badge}</span>}
        </Link>
      ))}
    </nav>
  );
  const foot = (
    <div className="space-y-2 border-t border-white/10 p-3">
      <div className="px-2 text-sm"><p className="truncate font-bold text-white">{user.name}</p><p className="text-xs text-white/50">{user.role}</p></div>
      <div className="grid grid-cols-2 gap-2"><Link href="/" className="btn btn-sm bg-white/10 text-white hover:bg-white/20">Voir le site</Link>
        <form action={logout}><button className="btn btn-sm w-full bg-white/10 text-white hover:bg-white/20">Quitter</button></form></div>
    </div>
  );
  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col bg-navy-950 lg:flex">
        <div className="flex h-16 items-center gap-2 px-5"><span className="h-display text-2xl text-white">JM <span className="text-electric-400">Admin</span></span></div>
        {list}{foot}
      </aside>
      <div className="sticky top-0 z-40 flex h-14 items-center justify-between bg-navy-950 px-3 text-white lg:hidden">
        <button onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Menu admin"><Icon name="menu" /></button>
        <span className="h-display text-xl">JM <span className="text-electric-400">Admin</span></span>
        <Link href="/" className="grid size-11 place-items-center rounded-full hover:bg-white/10" aria-label="Voir le site"><Icon name="home" /></Link>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-black/60" aria-label="Fermer" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] animate-fade flex-col bg-navy-950"><div className="flex h-14 items-center justify-between px-4"><span className="h-display text-xl text-white">Menu</span><button onClick={() => setOpen(false)} className="text-white" aria-label="Fermer"><Icon name="x" /></button></div>{list}{foot}</aside></div>
      )}
    </>
  );
}
