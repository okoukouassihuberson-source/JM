import { one, query, tx, type Tx } from "@/db";
import { loadCart, couponDiscount } from "./cart";
import { commitSale, releaseStock, reserveStock, StockError } from "./inventory";
import { notify, notifyRoles } from "./notify";
import { deliveryFee, type DeliveryMethod } from "./pricing";
import { numericCode } from "./security";
import { getSettings } from "./settings";

export class OrderError extends Error {}

export type OrderStatus = "received" | "payment_confirmed" | "preparing" | "ready" | "handed_to_driver" | "out_for_delivery" | "delivered" | "delivery_failed" | "cancelled";

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Commande reçue",
  payment_confirmed: "Paiement confirmé",
  preparing: "En préparation",
  ready: "Prête",
  handed_to_driver: "Remise au livreur",
  out_for_delivery: "En livraison",
  delivered: "Livrée",
  delivery_failed: "Échec de livraison",
  cancelled: "Annulée",
};
export const STATUS_TONE: Record<OrderStatus, string> = {
  received: "bg-electric-100 text-navy-700",
  payment_confirmed: "bg-electric-100 text-navy-700",
  preparing: "bg-warning-50 text-warning-600",
  ready: "bg-warning-50 text-warning-600",
  handed_to_driver: "bg-warning-50 text-warning-600",
  out_for_delivery: "bg-navy-900 text-white",
  delivered: "bg-success-50 text-success-600",
  delivery_failed: "bg-promo-50 text-promo-600",
  cancelled: "bg-slate-100 text-slate-600",
};
export const PAYMENT_LABEL: Record<string, string> = { cash_on_delivery: "Paiement à la livraison", mobile_money: "Mobile Money", online: "Paiement en ligne" };
export const PAY_STATUS_LABEL: Record<string, string> = { pending: "En attente", paid: "Payé", failed: "Échoué", refunded: "Remboursé" };
export const METHOD_LABEL: Record<DeliveryMethod, string> = { standard: "Livraison standard", express: "Livraison express", pickup: "Retrait sur place" };

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  received: ["payment_confirmed", "preparing", "cancelled"],
  payment_confirmed: ["preparing", "cancelled"],
  preparing: ["ready", "handed_to_driver", "cancelled"],
  ready: ["delivered", "handed_to_driver", "cancelled"],
  handed_to_driver: ["out_for_delivery", "delivery_failed", "cancelled"],
  out_for_delivery: ["delivered", "delivery_failed"],
  delivery_failed: ["handed_to_driver", "cancelled"],
  delivered: [],
  cancelled: [],
};
export const nextStatuses = (s: OrderStatus) => NEXT[s];
export const ACTIVE_STATUSES: OrderStatus[] = ["received", "payment_confirmed", "preparing", "ready", "handed_to_driver", "out_for_delivery", "delivery_failed"];

// ───────────── Création de commande ─────────────
export type CheckoutInput = {
  userId: string; customerName: string; customerPhone: string;
  method: DeliveryMethod; zoneId: string | null;
  commune: string; quartier: string; address: string; landmark: string; deliveryPhone: string; instructions: string;
  paymentMethod: "cash_on_delivery" | "mobile_money" | "online"; paymentReference: string; saveAddress: boolean;
};

async function nextOrderNumber(c: Tx) {
  const r = await one<{ n: number; d: string }>(
    `with d as (select to_char(now() at time zone 'Africa/Abidjan', 'YYYYMMDD') as d, (now() at time zone 'Africa/Abidjan')::date as day)
     insert into order_counters(day, n) select day, 1 from d
     on conflict (day) do update set n = order_counters.n + 1
     returning n, to_char(day, 'YYYYMMDD') as d`, [], c);
  return `JM-${r!.d}-${String(r!.n).padStart(4, "0")}`;
}

export async function createOrder(input: CheckoutInput): Promise<{ id: string; number: string }> {
  const settings = await getSettings();
  return tx(async (c) => {
    const cart = await one<{ id: string }>("select id from carts where user_id = $1", [input.userId], c);
    const view = await loadCart(cart?.id ?? null, c);
    if (!cart || view.lines.length === 0) throw new OrderError("Votre panier est vide.");
    const bad = view.lines.find((l) => !l.ok);
    if (bad) throw new OrderError(`« ${bad.name} » : ${bad.issue}. Modifiez votre panier.`);
    if (view.subtotal < settings.delivery.min_order) throw new OrderError(`Commande minimale : ${settings.delivery.min_order} FCFA.`);

    // Livraison
    let zone: { id: string; name: string; fee: number } | null = null;
    if (input.method === "pickup") {
      if (!settings.delivery.pickup_enabled) throw new OrderError("Le retrait sur place n'est pas disponible.");
    } else {
      if (input.method === "express" && !settings.delivery.express_enabled) throw new OrderError("La livraison express n'est pas disponible.");
      zone = await one("select id, name, fee from delivery_zones where id = $1 and active", [input.zoneId], c);
      if (!zone) throw new OrderError("Veuillez choisir une zone de livraison valide.");
      if (!input.address.trim() || !input.quartier.trim()) throw new OrderError("Adresse de livraison incomplète.");
    }
    if (input.paymentMethod === "cash_on_delivery" && !settings.payment.cash_on_delivery) throw new OrderError("Le paiement à la livraison n'est pas disponible.");
    if (input.paymentMethod === "mobile_money" && !settings.payment.mobile_money_manual) throw new OrderError("Ce moyen de paiement n'est pas disponible.");

    // Coupon (re-validé et consommé dans la transaction)
    let discount = 0, couponCode: string | null = null;
    if (view.coupon) {
      const used = await one("update coupons set used_count = used_count + 1 where upper(code) = upper($1) and (max_uses is null or used_count < max_uses) returning id", [view.coupon.code], c);
      if (!used) throw new OrderError("Ce code promo n'est plus disponible.");
      discount = couponDiscount(view.coupon, view.subtotal);
      couponCode = view.coupon.code;
    }
    const fee = deliveryFee(input.method, zone?.fee ?? 0, { expressSupplement: settings.delivery.express_supplement, freeThreshold: settings.delivery.free_delivery_threshold }, view.subtotal - discount);
    const total = view.subtotal - discount + fee;
    const number = await nextOrderNumber(c);
    const code = numericCode(4);

    const o = (await one<{ id: string }>(
      `insert into orders(number, user_id, delivery_method, zone_id, zone_name, subtotal, delivery_fee, discount, total, coupon_code, payment_method,
                          customer_name, customer_phone, commune, quartier, address_line, landmark, delivery_phone, instructions, delivery_code)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20) returning id`,
      [number, input.userId, input.method, zone?.id ?? null, zone?.name ?? null, view.subtotal, fee, discount, total, couponCode, input.paymentMethod,
        input.customerName, input.customerPhone, input.commune || null, input.quartier || null, input.address || null, input.landmark || null,
        input.deliveryPhone || input.customerPhone, input.instructions || null, input.method === "pickup" ? null : code], c))!;

    for (const l of view.lines) {
      await query(
        `insert into order_items(order_id, product_id, variant_id, name, variant_name, unit, unit_label, quantity, unit_price, original_unit_price, line_total, image_url)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [o.id, l.product_id, l.variant_id, l.name, l.variant_name, l.unit, l.unit_label, l.quantity, l.unit_price, l.original_price, l.line_total, l.image], c);
    }
    try {
      await reserveStock(c, o.id, input.userId, view.lines);
    } catch (e) {
      if (e instanceof StockError) throw new OrderError(e.message);
      throw e;
    }

    await query(
      "insert into payments(order_id, method, provider, amount, reference) values ($1,$2,$3,$4,$5)",
      [o.id, input.paymentMethod, input.paymentMethod === "online" ? "cinetpay" : "manual", total, input.paymentReference || null], c);
    if (input.method !== "pickup") await query("insert into deliveries(order_id) values ($1)", [o.id], c);
    await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,'received','Commande enregistrée',$2)", [o.id, input.userId], c);

    if (input.saveAddress && input.method !== "pickup") {
      const dup = await one("select 1 from addresses where user_id = $1 and lower(address) = lower($2) and lower(quartier) = lower($3)", [input.userId, input.address, input.quartier], c);
      if (!dup) {
        const first = !(await one("select 1 from addresses where user_id = $1", [input.userId], c));
        await query(
          "insert into addresses(user_id, label, commune, quartier, address, landmark, phone, instructions, is_default) values ($1,'Domicile',$2,$3,$4,$5,$6,$7,$8)",
          [input.userId, input.commune, input.quartier, input.address, input.landmark || null, input.deliveryPhone || input.customerPhone, input.instructions || null, first], c);
      }
    }

    await createInvoice(c, o.id);
    await query("update carts set coupon_code = null, updated_at = now() where id = $1", [cart.id], c);
    await query("delete from cart_items where cart_id = $1", [cart.id], c);

    await notify(input.userId, { type: "order_received", title: "Commande reçue", body: `Votre commande ${number} a bien été enregistrée.`, link: `/mon-espace/commandes/${number}` }, c);
    await notifyRoles(["super_admin", "manager", "preparer"], { type: "new_order", title: `Nouvelle commande ${number}`, body: `${input.customerName} — ${total} FCFA`, link: `/admin/commandes/${number}` }, c);
    return { id: o.id, number };
  });
}

// ───────────── Facture ─────────────
export async function createInvoice(c: Tx, orderId: string) {
  const settings = await getSettings();
  const o = (await one<any>("select * from orders where id = $1", [orderId], c))!;
  const items = await query<any>("select name, variant_name, unit, unit_label, quantity, unit_price, original_unit_price, line_total from order_items where order_id = $1 order by name", [orderId], c);
  const year = new Date().getFullYear();
  const n = (await one<{ n: number }>("insert into invoice_counters(year, n) values ($1,1) on conflict (year) do update set n = invoice_counters.n + 1 returning n", [year], c))!.n;
  const number = `F-${year}-${String(n).padStart(6, "0")}`;
  const data = {
    shop: { name: settings.brand.name, address: [settings.contact.address, settings.contact.city, settings.contact.country].filter(Boolean).join(", "), phone: settings.contact.phone, email: settings.contact.email },
    customer: { name: o.customer_name, phone: o.customer_phone, address: [o.address_line, o.quartier, o.commune].filter(Boolean).join(", ") },
    delivery_method: o.delivery_method, zone: o.zone_name, items,
    subtotal: o.subtotal, delivery_fee: o.delivery_fee, discount: o.discount, total: o.total, coupon: o.coupon_code, payment_method: o.payment_method, order_number: o.number,
  };
  await query("insert into invoices(number, order_id, total, data) values ($1,$2,$3,$4)", [number, orderId, o.total, JSON.stringify(data)], c);
}

// ───────────── Changement de statut ─────────────
const NOTIF: Partial<Record<OrderStatus, [string, string, string]>> = {
  payment_confirmed: ["payment_confirmed", "Paiement confirmé", "Nous avons bien reçu votre paiement."],
  preparing: ["order_preparing", "Commande en préparation", "Nos équipes préparent vos produits frais."],
  ready: ["order_ready", "Commande prête", "Votre commande est prête : vous pouvez la retirer."],
  handed_to_driver: ["order_ready", "Commande prête", "Votre commande est prête et remise au livreur."],
  out_for_delivery: ["order_delivery", "Commande en livraison", "Votre livreur est en route. Gardez votre code de livraison."],
  delivered: ["order_delivered", "Commande livrée", "Merci pour votre confiance ! Donnez votre avis sur vos produits."],
  delivery_failed: ["delivery_failed", "Échec de livraison", "La livraison n'a pas pu aboutir. Nous vous recontactons."],
  cancelled: ["order_cancelled", "Commande annulée", "Votre commande a été annulée."],
};

async function refreshDriver(c: Tx, driverId: string | null) {
  if (!driverId) return;
  await query(
    `update drivers d set status = case when exists (select 1 from deliveries x where x.driver_id = d.id and x.status in ('en_route','arrived')) then 'busy' else 'available' end
      where d.id = $1 and d.status <> 'unavailable'`, [driverId], c);
}

export async function changeStatus(orderId: string, to: OrderStatus, actorId: string | null, note?: string): Promise<void> {
  await tx(async (c) => {
    const o = await one<any>("select o.*, p.status as pay_status from orders o left join payments p on p.order_id = o.id where o.id = $1 for update of o", [orderId], c);
    if (!o) throw new OrderError("Commande introuvable.");
    const from = o.status as OrderStatus;
    if (!NEXT[from].includes(to)) throw new OrderError(`Transition impossible : ${STATUS_LABEL[from]} → ${STATUS_LABEL[to]}.`);
    const pickup = o.delivery_method === "pickup";
    const d = await one<any>("select * from deliveries where order_id = $1 for update", [orderId], c);

    if (to === "preparing" && o.payment_method !== "cash_on_delivery" && o.pay_status !== "paid")
      throw new OrderError("Le paiement doit d'abord être confirmé avant la préparation.");
    if (to === "ready" && !pickup) throw new OrderError("« Prête » concerne uniquement les retraits sur place.");
    if (to === "handed_to_driver" && (pickup || !d?.driver_id)) throw new OrderError("Affectez d'abord un livreur.");
    if (["out_for_delivery", "delivery_failed"].includes(to) && pickup) throw new OrderError("Action impossible pour un retrait.");
    if (to === "delivered" && !pickup && from !== "out_for_delivery") throw new OrderError("La commande doit être en livraison.");
    if (to === "cancelled" && o.pay_status === "paid") note = `${note ? note + " — " : ""}Paiement déjà encaissé : remboursement à effectuer.`;

    await query("update orders set status = $2, updated_at = now(), cancel_reason = case when $2 = 'cancelled' then $3 else cancel_reason end where id = $1", [orderId, to, note ?? null], c);
    await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,$2,$3,$4)", [orderId, to, note ?? null, actorId], c);

    if (to === "payment_confirmed") {
      await query("update payments set status = 'paid', paid_at = coalesce(paid_at, now()) where order_id = $1", [orderId], c);
    }
    if (to === "handed_to_driver" && d) {
      const z = o.zone_id ? await one<any>("select eta_min, eta_max from delivery_zones where id = $1", [o.zone_id], c) : null;
      const mins = z ? Math.round((z.eta_min + z.eta_max) / 2 * (o.delivery_method === "express" ? 0.6 : 1)) : 45;
      await query("update deliveries set status = case when accepted_at is null then 'assigned' else 'accepted' end, eta = now() + make_interval(mins => $2), failure_reason = null, failed_at = null where id = $1", [d.id, mins], c);
    }
    if (to === "out_for_delivery" && d) await query("update deliveries set status = 'en_route', started_at = now() where id = $1", [d.id], c);
    if (to === "delivery_failed" && d) await query("update deliveries set status = 'failed', failed_at = now(), failure_reason = $2 where id = $1", [d.id, note ?? null], c);
    if (to === "delivered") {
      if (d) await query("update deliveries set status = 'delivered', delivered_at = now() where id = $1", [d.id], c);
      await query("update payments set status = 'paid', paid_at = coalesce(paid_at, now()) where order_id = $1", [orderId], c);
      await commitSale(c, orderId, actorId);
    }
    if (to === "cancelled") await releaseStock(c, orderId, actorId);
    if (d) await refreshDriver(c, d.driver_id);

    const n = NOTIF[to];
    if (n) await notify(o.user_id, { type: n[0], title: n[1], body: `${o.number} — ${n[2]}`, link: `/mon-espace/commandes/${o.number}` }, c);
    if (to === "handed_to_driver" && d?.driver_id) {
      const dr = await one<{ user_id: string }>("select user_id from drivers where id = $1", [d.driver_id], c);
      if (dr) await notify(dr.user_id, { type: "driver_job", title: `Livraison à effectuer ${o.number}`, body: `${o.quartier ?? ""} — ${o.total} FCFA`, link: "/livreur" }, c);
    }
    if (to === "cancelled" && actorId !== o.user_id) { /* le client est déjà notifié ci-dessus */ }
    if (["delivery_failed"].includes(to)) await notifyRoles(["super_admin", "manager"], { type: "delivery_failed", title: `Échec de livraison ${o.number}`, body: note ?? "", link: `/admin/commandes/${o.number}` }, c);
  });
}

/** Annulation par le client (autorisée tant que la commande n'est pas partie en préparation avancée). */
export async function cancelByCustomer(orderNumber: string, userId: string) {
  const o = await one<{ id: string; status: OrderStatus }>("select id, status from orders where number = $1 and user_id = $2", [orderNumber, userId]);
  if (!o) throw new OrderError("Commande introuvable.");
  if (!["received", "payment_confirmed"].includes(o.status)) throw new OrderError("Cette commande est déjà en préparation : contactez-nous pour l'annuler.");
  await changeStatus(o.id, "cancelled", userId, "Annulée par le client");
}

export async function confirmPayment(orderId: string, actorId: string, reference?: string) {
  const o = await one<any>("select o.status, p.status as pay_status from orders o join payments p on p.order_id = o.id where o.id = $1", [orderId]);
  if (!o) throw new OrderError("Commande introuvable.");
  if (o.pay_status === "paid") throw new OrderError("Le paiement est déjà confirmé.");
  if (o.status === "cancelled") throw new OrderError("Commande annulée.");
  if (reference) await query("update payments set reference = $2 where order_id = $1", [orderId, reference]);
  if (o.status === "received") return changeStatus(orderId, "payment_confirmed", actorId);
  await query("update payments set status = 'paid', paid_at = now() where order_id = $1", [orderId]);
  await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,$2,'Paiement encaissé',$3)", [orderId, o.status, actorId]);
}

// ───────────── Livreurs ─────────────
export async function assignDriver(orderId: string, driverId: string, actorId: string) {
  await tx(async (c) => {
    const o = await one<any>("select * from orders where id = $1 for update", [orderId], c);
    if (!o) throw new OrderError("Commande introuvable.");
    if (o.delivery_method === "pickup") throw new OrderError("Un retrait sur place n'a pas de livreur.");
    if (["delivered", "cancelled"].includes(o.status)) throw new OrderError("Commande terminée.");
    const dr = await one<any>("select d.id, d.user_id, u.first_name, u.last_name, u.active from drivers d join users u on u.id = d.user_id where d.id = $1", [driverId], c);
    if (!dr?.active) throw new OrderError("Livreur introuvable ou désactivé.");
    const prev = await one<any>("select driver_id from deliveries where order_id = $1", [orderId], c);
    await query(
      `insert into deliveries(order_id, driver_id, status, assigned_at) values ($1,$2,'assigned', now())
       on conflict (order_id) do update set driver_id = excluded.driver_id, status = 'assigned', assigned_at = now(), accepted_at = null`, [orderId, driverId], c);
    await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,$2,$3,$4)", [orderId, o.status, `Livreur affecté : ${dr.first_name} ${dr.last_name}`, actorId], c);
    await notify(o.user_id, { type: "driver_assigned", title: "Livreur affecté", body: `${o.number} — ${dr.first_name} ${dr.last_name} s'occupera de votre livraison.`, link: `/mon-espace/commandes/${o.number}` }, c);
    await notify(dr.user_id, { type: "driver_job", title: `Nouvelle livraison ${o.number}`, body: `${o.quartier ?? ""} — ${o.total} FCFA`, link: "/livreur" }, c);
    if (prev?.driver_id && prev.driver_id !== driverId) await refreshDriver(c, prev.driver_id);
  });
}

async function driverDelivery(userId: string, orderId: string, c: Tx) {
  const d = await one<any>(
    `select d.*, o.status as order_status, o.number, o.user_id as customer_id, o.delivery_code, o.payment_method
       from deliveries d join drivers dr on dr.id = d.driver_id join orders o on o.id = d.order_id
      where d.order_id = $1 and dr.user_id = $2 for update of d`, [orderId, userId], c);
  if (!d) throw new OrderError("Livraison introuvable ou non affectée à vous.");
  return d;
}

export async function driverAccept(userId: string, orderId: string) {
  await tx(async (c) => {
    const d = await driverDelivery(userId, orderId, c);
    if (d.accepted_at) return;
    await query("update deliveries set accepted_at = now(), status = case when status = 'assigned' then 'accepted' else status end where id = $1", [d.id], c);
    await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,$2,'Livreur : course acceptée',$3)", [orderId, d.order_status, userId], c);
  });
}

export async function driverEnRoute(userId: string, orderId: string) {
  const d = await tx((c) => driverDelivery(userId, orderId, c));
  if (d.order_status !== "handed_to_driver") throw new OrderError("La commande n'a pas encore été remise au livreur.");
  if (!d.accepted_at) await driverAccept(userId, orderId);
  await changeStatus(orderId, "out_for_delivery", userId, "Le livreur est en route");
}

export async function driverArrived(userId: string, orderId: string) {
  await tx(async (c) => {
    const d = await driverDelivery(userId, orderId, c);
    if (d.order_status !== "out_for_delivery") throw new OrderError("Démarrez d'abord la livraison.");
    await query("update deliveries set status = 'arrived', arrived_at = now() where id = $1", [d.id], c);
    await query("insert into delivery_status_history(order_id, status, note, actor_id) values ($1,'out_for_delivery','Le livreur est arrivé',$2)", [orderId, userId], c);
    await notify(d.customer_id, { type: "order_delivery", title: "Votre livreur est arrivé", body: `${d.number} — il est devant chez vous.`, link: `/mon-espace/commandes/${d.number}` }, c);
  });
}

export async function driverDeliver(userId: string, orderId: string, p: { code?: string; comment?: string; photoUrl?: string | null }) {
  const settings = await getSettings();
  const d = await tx((c) => driverDelivery(userId, orderId, c));
  if (d.order_status !== "out_for_delivery") throw new OrderError("La commande n'est pas en cours de livraison.");
  if (settings.delivery.require_delivery_code && d.delivery_code && (p.code ?? "").trim() !== d.delivery_code)
    throw new OrderError("Code de livraison incorrect. Demandez-le au client.");
  await query("update deliveries set proof_comment = $2, proof_photo_url = $3 where id = $1", [d.id, p.comment || null, p.photoUrl ?? null]);
  await changeStatus(orderId, "delivered", userId, p.comment || "Livrée au client");
}

export async function driverFail(userId: string, orderId: string, reason: string) {
  const d = await tx((c) => driverDelivery(userId, orderId, c));
  if (!["handed_to_driver", "out_for_delivery"].includes(d.order_status)) throw new OrderError("Action impossible dans l'état actuel.");
  if (!reason.trim()) throw new OrderError("Indiquez la raison de l'échec.");
  await changeStatus(orderId, "delivery_failed", userId, reason.trim());
}

export async function updateDriverLocation(userId: string, lat: number, lng: number) {
  await query(
    `update deliveries d set last_lat = $2, last_lng = $3, location_updated_at = now()
      from drivers dr where dr.id = d.driver_id and dr.user_id = $1 and d.status in ('en_route','arrived')`, [userId, lat, lng]);
}

// ───────────── Avis ─────────────
export async function reviewableOrder(userId: string, productId: string): Promise<string | null> {
  const r = await one<{ id: string }>(
    `select o.id from orders o join order_items oi on oi.order_id = o.id
      where o.user_id = $1 and o.status = 'delivered' and oi.product_id = $2
        and not exists (select 1 from reviews r where r.user_id = $1 and r.product_id = $2 and r.order_id = o.id)
      order by o.created_at desc limit 1`, [userId, productId]);
  return r?.id ?? null;
}
