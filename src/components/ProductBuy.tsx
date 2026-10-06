"use client";
import { useState } from "react";
import { fcfa, formatQty } from "@/lib/format";
import { lineTotal, unitPrice, type PricedProduct, type QtyRules } from "@/lib/pricing";
import { AddToCart } from "./AddToCart";
import { PriceTag } from "./ui/bits";

type V = { id: string; name: string; price: number };
type Props = PricedProduct & QtyRules & { id: string; name: string; unit_label: string; available: number; variants: V[]; minZoneFee: number | null };

export function ProductBuy(p: Props) {
  const [vid, setVid] = useState<string | null>(p.variants[0]?.id ?? null);
  const [qty, setQty] = useState(p.min_qty);
  const v = p.variants.find((x) => x.id === vid);
  const up = unitPrice(p, v?.price);
  const sub = lineTotal(up.price, qty);
  const fee = p.minZoneFee ?? 0;
  return (
    <div className="space-y-5">
      {p.variants.length > 0 && (
        <fieldset>
          <legend className="label">Choisir une option</legend>
          <div className="flex flex-wrap gap-2">
            {p.variants.map((x) => (
              <label key={x.id} className={`cursor-pointer rounded-xl border-2 px-4 py-2.5 text-sm font-bold transition has-[:checked]:border-electric-500 has-[:checked]:bg-electric-50 has-[:checked]:text-electric-500 ${"border-line"}`}>
                <input type="radio" name="variant" className="sr-only" checked={vid === x.id} onChange={() => setVid(x.id)} />
                {x.name} <span className="font-semibold text-muted">· {fcfa(unitPrice(p, x.price).price)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div>
        <PriceTag price={up.price} original={up.onPromo ? up.original : undefined} u={p} size="lg" />
        {up.onPromo && <span className="badge mt-1 bg-promo-600 text-white">-{up.discountPct}% — offre limitée</span>}
      </div>
      <AddToCart productId={p.id} variantId={vid} unit={p.unit} unit_label={p.unit_label} step={p.step} min_qty={p.min_qty} allow_custom_qty={p.allow_custom_qty} available={p.available} onQty={setQty} buyNow name={p.name} />
      <dl className="card divide-y divide-line bg-electric-50/50 text-sm">
        <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Quantité</dt><dd className="font-bold">{formatQty(qty, p)}</dd></div>
        <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Sous-total</dt><dd className="font-bold">{fcfa(sub)}</dd></div>
        <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">Livraison</dt><dd className="font-bold">{p.minZoneFee == null ? "Selon la zone" : `dès ${fcfa(fee)}`}</dd></div>
        <div className="flex justify-between px-4 py-3 text-base"><dt className="font-extrabold text-navy-900">Total estimé</dt><dd className="font-black text-navy-900">{fcfa(sub + fee)}</dd></div>
      </dl>
    </div>
  );
}
