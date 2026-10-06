"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query } from "@/db";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { cancelByCustomer, OrderError } from "@/lib/orders";
import { initCinetpay } from "@/lib/payments/cinetpay";
import type { ActionState } from "@/components/ui/ActionForm";
import { notifyRoles } from "@/lib/notify";

const uuid = z.string().uuid();

export async function submitReviewAction(productId: string, orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: z.string().trim().max(600) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Note invalide." };
  // L'avis n'est possible que pour un produit réellement reçu (commande livrée du client).
  const ok = await one(
    `select 1 from orders o join order_items oi on oi.order_id = o.id where o.id = $1 and o.user_id = $2 and o.status = 'delivered' and oi.product_id = $3`, [orderId, u.id, productId]);
  if (!ok) return { error: "Vous ne pouvez noter que les produits livrés." };
  const r = await query("insert into reviews(product_id, user_id, order_id, rating, comment) values ($1,$2,$3,$4,$5) on conflict do nothing returning id", [productId, u.id, orderId, parsed.data.rating, parsed.data.comment]);
  if (!r.length) return { error: "Vous avez déjà donné votre avis." };
  revalidatePath("/produits/[slug]", "page");
  return { ok: true, message: "Merci pour votre avis !" };
}

export async function cancelOrderAction(number: string): Promise<ActionState> {
  const u = await requireUser();
  try {
    await cancelByCustomer(number, u.id);
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  revalidatePath("/mon-espace", "layout");
  return { ok: true, message: "Commande annulée." };
}

/** Lance le paiement en ligne (CinetPay) d'une commande à payer. Retourne l'URL de paiement. */
export async function payOnlineAction(number: string): Promise<ActionState & { url?: string }> {
  const u = await requireUser();
  const o = await one<any>("select o.id, o.number, o.total, o.customer_name, o.customer_phone, p.status as pay_status, p.method from orders o join payments p on p.order_id = o.id where o.number = $1 and o.user_id = $2 and o.status <> 'cancelled'", [number, u.id]);
  if (!o || o.method !== "online" || o.pay_status === "paid") return { error: "Paiement impossible pour cette commande." };
  try {
    return { ok: true, url: await initCinetpay(o) };
  } catch (e: any) {
    return { error: e.message || "Paiement en ligne indisponible." };
  }
}

/** Paiement Mobile Money manuel : le client renseigne la référence de sa transaction. */
export async function submitPaymentRefAction(number: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const ref = z.string().trim().min(4, "Référence trop courte").max(40).safeParse(fd.get("reference"));
  if (!ref.success) return { error: ref.error.issues[0].message };
  const o = await one<{ id: string }>("select o.id from orders o join payments p on p.order_id = o.id where o.number = $1 and o.user_id = $2 and p.method = 'mobile_money' and p.status = 'pending'", [number, u.id]);
  if (!o) return { error: "Commande introuvable." };
  await query("update payments set reference = $2 where order_id = $1", [o.id, ref.data]);
  await notifyRoles(["super_admin", "manager"], { type: "payment_ref", title: `Paiement à vérifier — ${number}`, body: `Réf. ${ref.data}`, link: `/admin/commandes/${number}` });
  revalidatePath(`/mon-espace/commandes/${number}`);
  return { ok: true, message: "Référence envoyée. Nous confirmons votre paiement très vite." };
}

// ───────────── Adresses ─────────────
const addrSchema = z.object({
  label: z.string().trim().min(1).max(30), commune: z.string().trim().min(2, "Commune requise").max(60), quartier: z.string().trim().min(2, "Quartier requis").max(80),
  address: z.string().trim().min(3, "Adresse requise").max(200), landmark: z.string().trim().max(150), instructions: z.string().trim().max(250),
  phone: z.string().trim().transform((v) => normalizePhone(v)).refine((v) => v, "Téléphone invalide"),
});

export async function saveAddressAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const p = addrSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (id) {
    if (!uuid.safeParse(id).success) return { error: "Adresse invalide." };
    await query("update addresses set label=$3, commune=$4, quartier=$5, address=$6, landmark=$7, instructions=$8, phone=$9 where id=$1 and user_id=$2", [id, u.id, d.label, d.commune, d.quartier, d.address, d.landmark || null, d.instructions || null, d.phone]);
  } else {
    const first = !(await one("select 1 from addresses where user_id = $1", [u.id]));
    await query("insert into addresses(user_id,label,commune,quartier,address,landmark,instructions,phone,is_default) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [u.id, d.label, d.commune, d.quartier, d.address, d.landmark || null, d.instructions || null, d.phone, first]);
  }
  revalidatePath("/mon-espace/adresses");
  return { ok: true, message: "Adresse enregistrée." };
}

export async function deleteAddressAction(id: string): Promise<ActionState> {
  const u = await requireUser();
  await query("delete from addresses where id = $1 and user_id = $2", [id, u.id]);
  revalidatePath("/mon-espace/adresses");
  return { ok: true, message: "Adresse supprimée." };
}

export async function defaultAddressAction(id: string): Promise<ActionState> {
  const u = await requireUser();
  await query("update addresses set is_default = (id = $1) where user_id = $2", [id, u.id]);
  revalidatePath("/mon-espace/adresses");
  return { ok: true, message: "Adresse par défaut mise à jour." };
}

// ───────────── Notifications ─────────────
export async function markNotificationsReadAction(id?: string): Promise<ActionState> {
  const u = await requireUser();
  await query("update notifications set read_at = now() where user_id = $1 and read_at is null and ($2::uuid is null or id = $2)", [u.id, id ?? null]);
  revalidatePath("/mon-espace", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true };
}
