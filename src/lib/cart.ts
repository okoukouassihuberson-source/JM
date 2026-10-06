import { cookies } from "next/headers";
import { one, query, type Tx } from "@/db";
import { getUser } from "./auth";
import { clampQty, lineTotal, MAX_QTY, unitPrice, validQty } from "./pricing";
import { newToken } from "./security";

const GUEST = "jm_cart";

export type CartLine = {
  id: string; product_id: string; variant_id: string | null; slug: string; name: string; variant_name: string | null;
  image: string | null; unit: string; unit_label: string; step: number; min_qty: number; allow_custom_qty: boolean;
  quantity: number; unit_price: number; original_price: number; on_promo: boolean; line_total: number;
  available: number; ok: boolean; issue: string | null;
};
export type CouponInfo = { code: string; type: "percent" | "fixed"; value: number; min_order: number };
export type CartView = { id: string | null; lines: CartLine[]; subtotal: number; discount: number; coupon: CouponInfo | null; couponError: string | null; count: number; valid: boolean };

export function couponDiscount(c: CouponInfo, subtotal: number): number {
  return Math.min(subtotal, c.type === "percent" ? Math.round((subtotal * c.value) / 100) : c.value);
}

/** Valide un coupon ; retourne le coupon ou un message d'erreur. */
export async function checkCoupon(code: string, subtotal: number, c?: Tx): Promise<{ coupon?: CouponInfo; error?: string }> {
  const row = await one<any>("select * from coupons where upper(code) = upper($1)", [code.trim()], c);
  if (!row || !row.active) return { error: "Code promo invalide." };
  if (row.expires_at && new Date(row.expires_at) < new Date()) return { error: "Ce code promo a expiré." };
  if (row.max_uses != null && row.used_count >= row.max_uses) return { error: "Ce code promo a atteint sa limite d'utilisation." };
  if (subtotal < row.min_order) return { error: `Commande minimale de ${row.min_order} FCFA pour ce code.` };
  return { coupon: { code: row.code, type: row.type, value: row.value, min_order: row.min_order } };
}

async function findCartId(): Promise<string | null> {
  const user = await getUser();
  if (user) return (await one<{ id: string }>("select id from carts where user_id = $1", [user.id]))?.id ?? null;
  const g = (await cookies()).get(GUEST)?.value;
  return g ? ((await one<{ id: string }>("select id from carts where guest_token = $1", [g]))?.id ?? null) : null;
}

/** Récupère (ou crée — actions uniquement) le panier courant. */
async function ensureCartId(): Promise<string> {
  const user = await getUser();
  if (user) {
    return (await one<{ id: string }>(
      "insert into carts(user_id) values ($1) on conflict (user_id) do update set updated_at = now() returning id", [user.id]))!.id;
  }
  const jar = await cookies();
  let g = jar.get(GUEST)?.value;
  if (g) {
    const c = await one<{ id: string }>("select id from carts where guest_token = $1", [g]);
    if (c) return c.id;
  }
  g = newToken();
  const c = await one<{ id: string }>("insert into carts(guest_token) values ($1) returning id", [g]);
  jar.set(GUEST, g, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 90 * 86400 });
  return c!.id;
}

export async function loadCart(cartId: string | null, c?: Tx): Promise<CartView> {
  if (!cartId) return { id: null, lines: [], subtotal: 0, discount: 0, coupon: null, couponError: null, count: 0, valid: true };
  const rows = await query<any>(
    `select ci.id, ci.product_id, ci.variant_id, ci.quantity, p.slug, p.name, p.unit, p.unit_label, p.step, p.min_qty, p.allow_custom_qty,
            p.price, p.promo_price, p.promo_active, p.promo_ends_at, p.active as p_active, cat.active as c_active,
            v.name as variant_name, v.price as variant_price, v.active as v_active,
            (select url from product_images i where i.product_id = p.id order by position, id limit 1) as image,
            coalesce(inv.on_hand - inv.reserved, 0) as available
       from cart_items ci
       join products p on p.id = ci.product_id
       join categories cat on cat.id = p.category_id
       left join product_variants v on v.id = ci.variant_id
       left join inventory inv on inv.product_id = p.id
      where ci.cart_id = $1 order by ci.created_at`,
    [cartId], c,
  );
  const lines: CartLine[] = rows.map((r) => {
    const up = unitPrice(r, r.variant_id ? r.variant_price : null);
    let issue: string | null = null;
    if (!r.p_active || !r.c_active || (r.variant_id && !r.v_active)) issue = "Produit indisponible";
    else if (r.available < r.quantity) issue = r.available <= 0 ? "Rupture de stock" : `Stock restant : ${r.available} ${r.unit_label}`;
    return {
      id: r.id, product_id: r.product_id, variant_id: r.variant_id, slug: r.slug, name: r.name, variant_name: r.variant_name,
      image: r.image, unit: r.unit, unit_label: r.unit_label, step: r.step, min_qty: r.min_qty, allow_custom_qty: r.allow_custom_qty,
      quantity: r.quantity, unit_price: up.price, original_price: up.original, on_promo: up.onPromo,
      line_total: lineTotal(up.price, r.quantity), available: r.available, ok: !issue, issue,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.line_total, 0);
  const cart = await one<{ coupon_code: string | null }>("select coupon_code from carts where id = $1", [cartId], c);
  let coupon: CouponInfo | null = null, couponError: string | null = null, discount = 0;
  if (cart?.coupon_code) {
    const r = await checkCoupon(cart.coupon_code, subtotal, c);
    if (r.coupon) { coupon = r.coupon; discount = couponDiscount(r.coupon, subtotal); } else couponError = r.error!;
  }
  return { id: cartId, lines, subtotal, discount, coupon, couponError, count: lines.length, valid: lines.length > 0 && lines.every((l) => l.ok) };
}

export async function getCart(): Promise<CartView> {
  return loadCart(await findCartId());
}

export async function cartCount(): Promise<number> {
  const id = await findCartId();
  if (!id) return 0;
  return (await one<{ n: number }>("select count(*) n from cart_items where cart_id = $1", [id]))!.n;
}

export async function addItem(productId: string, variantId: string | null, qty: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = await one<any>(
    `select p.*, coalesce(inv.on_hand - inv.reserved, 0) as available from products p
       join categories c on c.id = p.category_id left join inventory inv on inv.product_id = p.id
      where p.id = $1 and p.active and c.active`, [productId]);
  if (!p) return { ok: false, error: "Produit introuvable ou indisponible." };
  if (variantId && !(await one("select 1 from product_variants where id = $1 and product_id = $2 and active", [variantId, productId])))
    return { ok: false, error: "Variante indisponible." };
  if (!Number.isFinite(qty) || qty <= 0) return { ok: false, error: "Quantité invalide." };
  const cartId = await ensureCartId();
  const existing = await one<{ id: string; quantity: number }>(
    "select id, quantity from cart_items where cart_id = $1 and product_id = $2 and variant_id is not distinct from $3", [cartId, productId, variantId]);
  const total = clampQty((existing?.quantity ?? 0) + qty, p);
  if (total > p.available) return { ok: false, error: p.available <= 0 ? "Ce produit est en rupture de stock." : `Stock insuffisant : il reste ${p.available} ${p.unit_label}.` };
  if (existing) await query("update cart_items set quantity = $2 where id = $1", [existing.id, total]);
  else await query("insert into cart_items(cart_id, product_id, variant_id, quantity) values ($1,$2,$3,$4)", [cartId, productId, variantId, total]);
  await query("update carts set updated_at = now() where id = $1", [cartId]);
  return { ok: true };
}

export async function setItemQty(itemId: string, qty: number): Promise<{ ok: boolean; error?: string }> {
  const cartId = await findCartId();
  if (!cartId) return { ok: false, error: "Panier introuvable." };
  const it = await one<any>(
    `select ci.id, p.unit, p.step, p.min_qty, p.allow_custom_qty, p.unit_label, coalesce(inv.on_hand - inv.reserved, 0) as available
       from cart_items ci join products p on p.id = ci.product_id left join inventory inv on inv.product_id = p.id
      where ci.id = $1 and ci.cart_id = $2`, [itemId, cartId]);
  if (!it) return { ok: false, error: "Article introuvable." };
  if (qty > MAX_QTY || !Number.isFinite(qty)) return { ok: false, error: "Quantité invalide." };
  const q = clampQty(qty, it);
  if (!validQty(q, it)) return { ok: false, error: "Quantité invalide." };
  if (q > it.available) return { ok: false, error: `Stock insuffisant : il reste ${it.available} ${it.unit_label}.` };
  await query("update cart_items set quantity = $2 where id = $1", [itemId, q]);
  return { ok: true };
}

export async function removeItem(itemId: string) {
  const cartId = await findCartId();
  if (cartId) await query("delete from cart_items where id = $1 and cart_id = $2", [itemId, cartId]);
}

export async function applyCoupon(code: string): Promise<{ ok: boolean; error?: string }> {
  const cartId = await findCartId();
  if (!cartId) return { ok: false, error: "Votre panier est vide." };
  const v = await loadCart(cartId);
  const r = await checkCoupon(code, v.subtotal);
  if (!r.coupon) return { ok: false, error: r.error };
  await query("update carts set coupon_code = $2 where id = $1", [cartId, r.coupon.code]);
  return { ok: true };
}

export async function removeCoupon() {
  const cartId = await findCartId();
  if (cartId) await query("update carts set coupon_code = null where id = $1", [cartId]);
}

/** À la connexion / inscription : fusionne le panier invité dans celui du compte. */
export async function mergeGuestCart(userId: string) {
  const jar = await cookies();
  const g = jar.get(GUEST)?.value;
  if (!g) return;
  const guest = await one<{ id: string; coupon_code: string | null }>("select id, coupon_code from carts where guest_token = $1", [g]);
  if (guest) {
    const mine = (await one<{ id: string }>("insert into carts(user_id) values ($1) on conflict (user_id) do update set updated_at = now() returning id", [userId]))!.id;
    await query(
      `insert into cart_items(cart_id, product_id, variant_id, quantity)
       select $1, product_id, variant_id, quantity from cart_items where cart_id = $2
       on conflict (cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid))
       do update set quantity = cart_items.quantity + excluded.quantity`, [mine, guest.id]);
    if (guest.coupon_code) await query("update carts set coupon_code = coalesce(coupon_code, $2) where id = $1", [mine, guest.coupon_code]);
    await query("delete from carts where id = $1", [guest.id]);
  }
  jar.delete(GUEST);
}
