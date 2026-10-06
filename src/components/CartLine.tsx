"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { removeItemAction, updateQtyAction } from "@/actions/cart";
import type { CartLine as Line } from "@/lib/cart";
import { fcfa, unitShort } from "@/lib/format";
import { QtyStepper } from "./AddToCart";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

export function CartLineRow({ l }: { l: Line }) {
  const [qty, setQty] = useState(l.quantity);
  const [pending, start] = useTransition();
  const toast = useToast();
  const change = (q: number) => {
    const prev = qty;
    setQty(q);
    start(async () => { const r = await updateQtyAction(l.id, q); if (r.error) { toast(r.error, "error"); setQty(prev); } });
  };
  return (
    <li className={`card flex gap-3 p-3 transition sm:gap-4 sm:p-4 ${pending ? "opacity-70" : ""} ${l.ok ? "" : "border-promo-600/40"}`}>
      <Link href={`/produits/${l.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-xl bg-electric-50 sm:size-28">
        {l.image && <Image src={l.image} alt={l.name} fill sizes="112px" className="object-cover" />}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <Link href={`/produits/${l.slug}`} className="block truncate text-base font-extrabold text-navy-900 hover:text-electric-500">{l.name}</Link>
            {l.variant_name && <p className="text-xs font-semibold text-muted">{l.variant_name}</p>}
            <p className="text-xs text-muted">{fcfa(l.unit_price)} / {unitShort(l)} {l.on_promo && <span className="ml-1 font-bold text-promo-600 line-through">{fcfa(l.original_price, false)}</span>}</p>
          </div>
          <button type="button" aria-label={`Retirer ${l.name}`} className="grid size-9 shrink-0 place-items-center rounded-full text-muted hover:bg-promo-50 hover:text-promo-600"
            onClick={() => start(async () => { const r = await removeItemAction(l.id); toast(r.message ?? "Retiré"); })}><Icon name="trash" size={18} /></button>
        </div>
        {l.issue && <p className="flex items-center gap-1.5 text-xs font-bold text-promo-600"><Icon name="alert" size={14} />{l.issue}</p>}
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
          <QtyStepper qty={qty} rules={l} onChange={change} size="sm" />
          <p className="text-lg font-black text-navy-900">{fcfa(Math.round(l.unit_price * qty))}</p>
        </div>
      </div>
    </li>
  );
}
