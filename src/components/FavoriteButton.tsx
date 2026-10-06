"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toggleFavoriteAction } from "@/actions/cart";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function FavoriteButton({ productId, initial, className = "" }: { productId: string; initial: boolean; className?: string }) {
  const [fav, setFav] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  return (
    <button type="button" disabled={pending} aria-pressed={fav} aria-label={fav ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`grid size-10 place-items-center rounded-full bg-white/95 shadow-card transition active:scale-90 ${fav ? "text-promo-500" : "text-navy-900 hover:text-promo-500"} ${className}`}
      onClick={() => start(async () => {
        const r = await toggleFavoriteAction(productId);
        if (r.needLogin) { toast("Connectez-vous pour utiliser les favoris", "error"); return router.push(`/connexion?next=${encodeURIComponent(location.pathname)}`); }
        if (r.ok) { setFav(!!r.fav); toast(r.fav ? "Ajouté aux favoris" : "Retiré des favoris"); }
      })}>
      <Icon name="heart" size={19} className={fav ? "fill-current" : ""} />
    </button>
  );
}
