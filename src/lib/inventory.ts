import { one, query, type Tx } from "@/db";
import { notify, notifyRoles } from "./notify";

export type Movement = "restock" | "reserve" | "release" | "sale" | "adjustment" | "loss" | "initial";

async function log(c: Tx, productId: string, type: Movement, onHand: number, reserved: number, orderId: string | null, userId: string | null, note?: string) {
  await query(
    "insert into inventory_movements(product_id, type, on_hand_delta, reserved_delta, order_id, user_id, note) values ($1,$2,$3,$4,$5,$6,$7)",
    [productId, type, onHand, reserved, orderId, userId, note ?? null], c,
  );
}

/** Alerte automatique : stock disponible ≤ seuil (une seule fois jusqu'au réapprovisionnement). */
export async function checkLowStock(c: Tx, productId: string) {
  const r = await one<any>(
    `select p.name, p.unit_label, i.on_hand - i.reserved as available, i.alert_threshold, i.low_alert_sent
       from inventory i join products p on p.id = i.product_id where i.product_id = $1`, [productId], c);
  if (!r) return;
  if (r.available <= r.alert_threshold && r.alert_threshold > 0 && !r.low_alert_sent) {
    await notifyRoles(["super_admin", "manager", "stock_manager"], {
      type: "stock_low", title: `Stock faible : ${r.name}`,
      body: `Il reste ${r.available} ${r.unit_label} (seuil d'alerte : ${r.alert_threshold}).`, link: "/admin/stock",
    }, c);
    await query("update inventory set low_alert_sent = true where product_id = $1", [productId], c);
  } else if (r.available > r.alert_threshold && r.low_alert_sent) {
    await query("update inventory set low_alert_sent = false where product_id = $1", [productId], c);
  }
}

/** Réserve du stock pour une commande (lignes agrégées par produit, verrouillage anti-survente). */
export async function reserveStock(c: Tx, orderId: string, userId: string, items: { product_id: string; name: string; quantity: number }[]) {
  const byProduct = new Map<string, { name: string; qty: number }>();
  for (const it of items) {
    const e = byProduct.get(it.product_id) ?? { name: it.name, qty: 0 };
    e.qty += it.quantity;
    byProduct.set(it.product_id, e);
  }
  for (const pid of [...byProduct.keys()].sort()) {
    const { name, qty } = byProduct.get(pid)!;
    const inv = await one<{ on_hand: number; reserved: number }>("select on_hand, reserved from inventory where product_id = $1 for update", [pid], c);
    if (!inv || inv.on_hand - inv.reserved < qty - 1e-9) throw new StockError(`Stock insuffisant pour « ${name} ».`);
    await query("update inventory set reserved = reserved + $2, updated_at = now() where product_id = $1", [pid, qty], c);
    await log(c, pid, "reserve", 0, qty, orderId, userId);
    await checkLowStock(c, pid);
  }
}

export class StockError extends Error {}

type Line = { product_id: string | null; quantity: number };

/** Annulation : libère les quantités réservées. */
export async function releaseStock(c: Tx, orderId: string, userId: string | null) {
  const o = await one<{ stock_state: string }>("select stock_state from orders where id = $1 for update", [orderId], c);
  if (o?.stock_state !== "reserved") return;
  const lines = await query<Line>("select product_id, sum(quantity)::float as quantity from order_items where order_id = $1 and product_id is not null group by product_id", [orderId], c);
  for (const l of lines) {
    await query("update inventory set reserved = greatest(0, reserved - $2), updated_at = now() where product_id = $1", [l.product_id, l.quantity], c);
    await log(c, l.product_id!, "release", 0, -l.quantity, orderId, userId, "Commande annulée");
    await checkLowStock(c, l.product_id!);
  }
  await query("update orders set stock_state = 'released' where id = $1", [orderId], c);
}

/** Livraison : le stock réservé devient vendu (sortie physique). */
export async function commitSale(c: Tx, orderId: string, userId: string | null) {
  const o = await one<{ stock_state: string }>("select stock_state from orders where id = $1 for update", [orderId], c);
  if (o?.stock_state !== "reserved") return;
  const lines = await query<Line>("select product_id, sum(quantity)::float as quantity from order_items where order_id = $1 and product_id is not null group by product_id", [orderId], c);
  for (const l of lines) {
    await query(
      `update inventory set on_hand = greatest(0, on_hand - $2), reserved = greatest(0, reserved - $2), sold = sold + $2, updated_at = now() where product_id = $1`,
      [l.product_id, l.quantity], c);
    await log(c, l.product_id!, "sale", -l.quantity, -l.quantity, orderId, userId);
    await checkLowStock(c, l.product_id!);
  }
  await query("update orders set stock_state = 'sold' where id = $1", [orderId], c);
}

/** Réapprovisionnement / correction / perte (gestionnaire de stock). `delta` positif ou négatif. */
export async function adjustStock(c: Tx, productId: string, type: "restock" | "adjustment" | "loss" | "initial", delta: number, userId: string | null, note?: string) {
  const before = await one<{ on_hand: number; reserved: number; name: string; unit_label: string }>(
    `select i.on_hand, i.reserved, p.name, p.unit_label from inventory i join products p on p.id = i.product_id where i.product_id = $1 for update`, [productId], c);
  if (!before) throw new Error("Produit sans fiche de stock.");
  const next = Math.round((before.on_hand + delta) * 1000) / 1000;
  if (next < before.reserved - 1e-9) throw new StockError(`Impossible : ${before.reserved} ${before.unit_label} sont réservés par des commandes en cours.`);
  if (next < 0) throw new StockError("Le stock ne peut pas être négatif.");
  await query("update inventory set on_hand = $2, updated_at = now() where product_id = $1", [productId, next], c);
  await log(c, productId, type, delta, 0, null, userId, note);
  await checkLowStock(c, productId);
  if (before.on_hand - before.reserved <= 0 && next - before.reserved > 0) {
    // Retour en stock : prévenir les clients qui ont ce produit en favori.
    const favs = await query<{ user_id: string }>("select user_id from favorites where product_id = $1", [productId], c);
    for (const f of favs) await notify(f.user_id, { type: "back_in_stock", title: `${before.name} est de nouveau disponible`, body: "Commandez-le avant la rupture !", link: "/mon-espace/favoris" }, c);
  }
}
