import type { Metadata } from "next";
import Link from "next/link";
import { applyCouponAction, removeCouponAction } from "@/actions/cart";
import { CartLineRow } from "@/components/CartLine";
import { ActionButton, ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Empty, PageTitle } from "@/components/ui/bits";
import { query } from "@/db";
import { getUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { fcfa } from "@/lib/format";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Mon panier", robots: { index: false } };

export default async function Panier() {
  const [cart, user, s, zones] = await Promise.all([getCart(), getUser(), getSettings(), query<{ fee: number }>("select min(fee)::int fee from delivery_zones where active")]);
  if (cart.lines.length === 0) return <div className="mx-auto max-w-2xl px-4 py-14"><Empty icon="cart" title="Votre panier est vide" text="Ajoutez des produits frais pour commencer votre commande." href="/produits" cta="Découvrir nos produits" /></div>;
  const minFee = zones[0]?.fee;
  const total = cart.subtotal - cart.discount;
  const freeLeft = s.delivery.free_delivery_threshold > 0 ? s.delivery.free_delivery_threshold - total : 0;
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageTitle eyebrow="Étape 1" title="Mon panier" />
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">{cart.lines.map((l) => <CartLineRow key={l.id} l={l} />)}</ul>
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <div className="card space-y-4 p-5">
            <h2 className="h-display text-2xl text-navy-900">Résumé</h2>
            {cart.coupon ? (
              <div className="flex items-center justify-between rounded-xl bg-success-50 px-3 py-2 text-sm font-bold text-success-600">
                <span className="flex items-center gap-2"><Icon name="tag" size={16} /> {cart.coupon.code}</span>
                <ActionButton action={removeCouponAction} className="text-xs underline" successToast={false}>Retirer</ActionButton>
              </div>
            ) : (
              <ActionForm action={applyCouponAction} className="flex gap-2">
                <input name="code" placeholder="Code promo" aria-label="Code promo" className="input uppercase" autoComplete="off" maxLength={40} />
                <Submit className="btn-outline" pendingText="…">Appliquer</Submit>
              </ActionForm>
            )}
            {cart.couponError && <p className="text-xs font-semibold text-promo-600">{cart.couponError}</p>}
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="font-bold">{fcfa(cart.subtotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Réduction</dt><dd className={`font-bold ${cart.discount ? "text-promo-600" : ""}`}>{cart.discount ? `- ${fcfa(cart.discount)}` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Livraison</dt><dd className="font-bold">{minFee != null ? `dès ${fcfa(minFee)}` : "Selon zone"}</dd></div>
              <div className="flex items-end justify-between border-t border-line pt-3"><dt className="font-extrabold uppercase text-navy-900">Total</dt><dd className="h-display text-3xl text-navy-900" style={{ textTransform: "none" }}>{fcfa(total)}</dd></div>
            </dl>
            {freeLeft > 0 && <p className="rounded-xl bg-electric-50 px-3 py-2 text-xs font-semibold text-navy-800">Plus que {fcfa(freeLeft)} pour la livraison offerte !</p>}
            {!cart.valid && <p className="rounded-xl bg-promo-50 px-3 py-2 text-xs font-bold text-promo-600">Corrigez les articles signalés pour continuer.</p>}
            <Link href={user ? "/commande" : "/connexion?next=/commande"} aria-disabled={!cart.valid} className={`btn-primary btn-lg w-full ${cart.valid ? "" : "pointer-events-none opacity-50"}`}>PASSER LA COMMANDE</Link>
            {!user && <p className="text-center text-xs text-muted">Un compte est nécessaire pour suivre votre livraison. <Link href="/inscription?next=/commande" className="font-bold text-electric-500">Créer un compte</Link></p>}
            <Link href="/produits" className="block text-center text-sm font-bold text-electric-500">← Continuer mes achats</Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
