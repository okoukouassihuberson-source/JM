"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { query } from "@/db";
import { getUser } from "@/lib/auth";
import { addItem, applyCoupon, removeCoupon, removeItem, setItemQty } from "@/lib/cart";
import type { ActionState } from "@/components/ui/ActionForm";

const id = z.string().uuid();
const refresh = () => revalidatePath("/", "layout");

export async function addToCartAction(productId: string, variantId: string | null, qty: number): Promise<{ ok: boolean; error?: string }> {
  const p = z.object({ p: id, v: id.nullable(), q: z.number().positive().max(500) }).safeParse({ p: productId, v: variantId, q: qty });
  if (!p.success) return { ok: false, error: "Requête invalide." };
  const r = await addItem(p.data.p, p.data.v, p.data.q);
  if (r.ok) refresh();
  return r.ok ? { ok: true } : r;
}

export async function updateQtyAction(itemId: string, qty: number): Promise<ActionState> {
  if (!id.safeParse(itemId).success) return { error: "Requête invalide." };
  const r = await setItemQty(itemId, qty);
  refresh();
  return r.ok ? { ok: true } : { error: r.error };
}

export async function removeItemAction(itemId: string): Promise<ActionState> {
  if (!id.safeParse(itemId).success) return { error: "Requête invalide." };
  await removeItem(itemId);
  refresh();
  return { ok: true, message: "Article retiré du panier." };
}

export async function applyCouponAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const code = String(fd.get("code") ?? "").trim().slice(0, 40);
  if (!code) return { error: "Saisissez un code promo." };
  const r = await applyCoupon(code);
  refresh();
  return r.ok ? { ok: true, message: "Code promo appliqué." } : { error: r.error };
}

export async function removeCouponAction(): Promise<ActionState> {
  await removeCoupon();
  refresh();
  return { ok: true, message: "Code promo retiré." };
}

export async function toggleFavoriteAction(productId: string): Promise<{ ok: boolean; fav?: boolean; needLogin?: boolean }> {
  const u = await getUser();
  if (!u) return { ok: false, needLogin: true };
  if (!id.safeParse(productId).success) return { ok: false };
  const del = await query("delete from favorites where user_id = $1 and product_id = $2 returning 1", [u.id, productId]);
  if (del.length) { revalidatePath("/mon-espace/favoris"); return { ok: true, fav: false }; }
  await query("insert into favorites(user_id, product_id) select $1, id from products where id = $2 on conflict do nothing", [u.id, productId]);
  revalidatePath("/mon-espace/favoris");
  return { ok: true, fav: true };
}
