// Règles de prix et de quantité — source unique, utilisée par le panier, le checkout et l'UI.

export type PricedProduct = {
  price: number;
  promo_price: number | null;
  promo_active: boolean;
  promo_ends_at: Date | string | null;
};

export function promoLive(p: PricedProduct, now = new Date()): boolean {
  if (!p.promo_active || p.promo_price == null || p.promo_price >= p.price) return false;
  return !p.promo_ends_at || new Date(p.promo_ends_at) > now;
}

/** Prix unitaire effectif. Une variante reçoit la même remise (en %) que le produit. */
export function unitPrice(p: PricedProduct, variantPrice?: number | null) {
  const base = variantPrice ?? p.price;
  if (!promoLive(p)) return { price: base, original: base, discountPct: 0, onPromo: false };
  const ratio = p.promo_price! / p.price;
  const price = variantPrice != null ? Math.round(base * ratio) : p.promo_price!;
  return { price, original: base, discountPct: Math.round((1 - ratio) * 100), onPromo: true };
}

export const lineTotal = (unit: number, qty: number) => Math.round(unit * qty);

export type QtyRules = { unit: string; step: number; min_qty: number; allow_custom_qty: boolean };
export const MAX_QTY = 500;

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Ramène une quantité dans les règles du produit (jamais d'exception : utile pour les steppers). */
export function clampQty(q: number, r: QtyRules): number {
  if (!Number.isFinite(q)) return r.min_qty;
  q = Math.min(MAX_QTY, Math.max(r.min_qty, q));
  const grid = r.allow_custom_qty ? 0.01 : r.step;
  return round3(Math.round(q / grid) * grid);
}

export function validQty(q: number, r: QtyRules): boolean {
  return Number.isFinite(q) && q >= r.min_qty && q <= MAX_QTY && Math.abs(clampQty(q, r) - q) < 1e-9;
}

export const stepQty = (q: number, dir: 1 | -1, r: QtyRules) => clampQty(round3(q + dir * r.step), r);

export type DeliveryMethod = "standard" | "express" | "pickup";

/** Frais de livraison : tarif de zone (+ supplément express) ; offerts au-delà du seuil (standard uniquement). */
export function deliveryFee(method: DeliveryMethod, zoneFee: number, o: { expressSupplement: number; freeThreshold: number }, subtotalAfterDiscount: number): number {
  if (method === "pickup") return 0;
  if (method === "standard" && o.freeThreshold > 0 && subtotalAfterDiscount >= o.freeThreshold) return 0;
  return zoneFee + (method === "express" ? o.expressSupplement : 0);
}
