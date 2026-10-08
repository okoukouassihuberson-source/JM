"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Icon } from "../ui/Icon";

export function MobileMenu({ user, categories, nav, logout }: { user: { name: string; home: string } | null; categories: { slug: string; name: string }[]; nav: { href: string; label: string }[]; logout: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const path = usePathname();
  useEffect(() => setOpen(false), [path]);
  useEffect(() => { document.body.style.overflow = open ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [open]);
  return (
    <div className="lg:hidden">
      <button type="button" onClick={() => setOpen(true)} className="grid size-11 place-items-center rounded-full text-navy-900 hover:bg-electric-50" aria-label="Ouvrir le menu" aria-expanded={open}><Icon name="menu" size={24} /></button>
      {open && mounted && createPortal(
        <div className="fixed inset-0 z-[90] animate-fade" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-navy-950/60" aria-label="Fermer le menu" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-[84%] max-w-sm flex-col gap-1 overflow-y-auto bg-white p-4 shadow-pop">
            <div className="mb-2 flex items-center justify-between">
              <span className="h-display text-2xl text-navy-900">Menu</span>
              <button onClick={() => setOpen(false)} className="grid size-10 place-items-center rounded-full hover:bg-electric-50" aria-label="Fermer"><Icon name="x" /></button>
            </div>
            {nav.map((n) => <Link key={n.href} href={n.href} className={`rounded-xl px-4 py-3 text-base font-bold ${path === n.href ? "bg-electric-50 text-electric-500" : "text-navy-900"} ${n.href === "/promotions" ? "!text-promo-600" : ""}`}>{n.label}</Link>)}
            <p className="mt-3 px-4 text-xs font-extrabold uppercase tracking-widest text-muted">Catégories</p>
            {categories.map((c) => <Link key={c.slug} href={`/produits?categorie=${c.slug}`} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-navy-900 hover:bg-electric-50">{c.name}</Link>)}
            <div className="mt-auto grid gap-2 border-t border-line pt-4">
              {user ? (<>
                <Link href={user.home} className="btn-navy"><Icon name="user" size={18} /> Mon espace — {user.name}</Link>
                <form action={logout}><button className="btn-outline w-full"><Icon name="logout" size={18} /> Se déconnecter</button></form>
              </>) : (<>
                <Link href="/connexion" className="btn-primary">Se connecter</Link>
                <Link href="/inscription" className="btn-outline">Créer un compte</Link>
              </>)}
            </div>
          </aside>
        </div>,
        document.body,
      )}
    </div>
  );
}
