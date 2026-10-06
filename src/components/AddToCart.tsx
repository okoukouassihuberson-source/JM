"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addToCartAction } from "@/actions/cart";
import { formatQty, num } from "@/lib/format";
import { clampQty, stepQty, type QtyRules } from "@/lib/pricing";
import { Icon } from "./ui/Icon";
import { useToast } from "./ui/Toast";

type Props = QtyRules & { productId: string; unit_label: string; available: number; variantId?: string | null; buyNow?: boolean; compact?: boolean; onQty?: (q: number) => void; name?: string };

export function QtyStepper({ qty, rules, onChange, label, size = "md" }: { qty: number; rules: QtyRules & { unit_label: string }; onChange: (q: number) => void; label?: string; size?: "sm" | "md" }) {
  const [edit, setEdit] = useState(false);
  const h = size === "sm" ? "h-10" : "h-12";
  return (
    <div className={`flex ${h} items-center rounded-xl border-2 border-line bg-white`} role="group" aria-label="Quantité">
      <button type="button" className={`grid h-full ${size === "sm" ? "w-9" : "w-11"} shrink-0 place-items-center text-navy-900 transition hover:text-electric-500 disabled:opacity-30`} aria-label="Diminuer la quantité" disabled={qty <= rules.min_qty} onClick={() => onChange(stepQty(qty, -1, rules))}><Icon name="minus" size={18} /></button>
      {edit ? (
        <input autoFocus type="number" inputMode="decimal" min={rules.min_qty} step={rules.allow_custom_qty ? 0.05 : rules.step} defaultValue={qty} aria-label="Quantité personnalisée"
          className="h-full w-20 bg-transparent text-center text-sm font-extrabold text-navy-900 outline-none"
          onBlur={(e) => { onChange(clampQty(parseFloat(e.target.value.replace(",", ".")), rules)); setEdit(false); }}
          onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} />
      ) : (
        <button type="button" disabled={!rules.allow_custom_qty} onClick={() => setEdit(true)} title={rules.allow_custom_qty ? "Saisir une quantité" : undefined}
          className="min-w-0 flex-1 truncate px-1 text-center text-[13px] font-extrabold uppercase text-navy-900 sm:text-sm">{label ?? formatQty(qty, rules).toUpperCase()}</button>
      )}
      <button type="button" className={`grid h-full ${size === "sm" ? "w-9" : "w-11"} shrink-0 place-items-center text-navy-900 transition hover:text-electric-500`} aria-label="Augmenter la quantité" onClick={() => onChange(stepQty(qty, 1, rules))}><Icon name="plus" size={18} /></button>
    </div>
  );
}

export function AddToCart({ productId, variantId = null, available, buyNow, compact, onQty, name, ...rules }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [qty, setQty] = useState(rules.min_qty);
  const [pending, start] = useTransition();
  const out = available <= 0;
  const change = (q: number) => { setQty(q); onQty?.(q); };

  const add = (go: boolean) => start(async () => {
    const r = await addToCartAction(productId, variantId, qty);
    if (!r.ok) return toast(r.error ?? "Impossible d'ajouter au panier.", "error");
    if (go) return router.push("/panier");
    toast(`${name ? name + " — " : ""}${formatQty(qty, rules)} ajouté au panier`);
  });

  return (
    <div className={compact ? "grid gap-2" : "grid gap-3 sm:grid-cols-[auto_1fr_1fr]"}>
      <QtyStepper qty={qty} rules={rules} onChange={change} size={compact ? "sm" : "md"} />
      {qty > available && !out && <p className="text-xs font-semibold text-warning-600 sm:col-span-3">Stock restant : {num(available)} {rules.unit_label}</p>}
      <button type="button" disabled={out || pending} onClick={() => add(false)} className={`${buyNow ? "btn-outline" : "btn-primary"} ${compact ? "btn-sm min-h-10 w-full" : "min-h-12"} ${pending ? "opacity-70" : ""}`}>
        <Icon name="cart" size={compact ? 16 : 18} />
        {out ? "Indisponible" : pending ? "Ajout…" : compact ? "Ajouter" : "AJOUTER AU PANIER"}
      </button>
      {buyNow && <button type="button" disabled={out || pending} onClick={() => add(true)} className="btn-navy min-h-12">ACHETER MAINTENANT</button>}
    </div>
  );
}
