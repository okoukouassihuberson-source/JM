"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query } from "@/db";
import { audit } from "@/lib/audit";
import { requirePerm } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { assignDriver, changeStatus, confirmPayment, OrderError, type OrderStatus } from "@/lib/orders";
import type { ActionState } from "@/components/ui/ActionForm";

const uuid = z.string().uuid();
const STATUSES = ["payment_confirmed", "preparing", "ready", "handed_to_driver", "out_for_delivery", "delivered", "delivery_failed", "cancelled"] as const;

const PERM: Record<string, string[]> = {
  payment_confirmed: ["payments.manage"], preparing: ["orders.prepare", "orders.manage"], ready: ["orders.prepare", "orders.manage"], handed_to_driver: ["orders.prepare", "orders.manage"],
  out_for_delivery: ["orders.manage"], delivered: ["orders.manage"], delivery_failed: ["orders.manage"], cancelled: ["orders.cancel"],
};

async function guard(fn: () => Promise<void>, ok: string): Promise<ActionState> {
  try {
    await fn();
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    if (e instanceof Error && /Accès refusé|connecter/.test(e.message)) return { error: e.message };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: ok };
}

export async function setStatusAction(orderId: string, to: string, note?: string): Promise<ActionState> {
  if (!uuid.safeParse(orderId).success || !(STATUSES as readonly string[]).includes(to)) return { error: "Requête invalide." };
  return guard(async () => {
    const u = await requirePerm(...PERM[to]);
    await changeStatus(orderId, to as OrderStatus, u.id, note?.slice(0, 300));
    await audit(u.id, `order.status.${to}`, "order", orderId, { note });
  }, "Statut mis à jour.");
}

export async function cancelWithReasonAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  return setStatusAction(orderId, "cancelled", String(fd.get("reason") ?? "Annulée par la boutique"));
}

export async function assignDriverAction(orderId: string, driverId: string): Promise<ActionState> {
  if (!uuid.safeParse(orderId).success || !uuid.safeParse(driverId).success) return { error: "Choisissez un livreur." };
  return guard(async () => {
    const u = await requirePerm("orders.assign");
    await assignDriver(orderId, driverId, u.id);
    await audit(u.id, "order.assign_driver", "order", orderId, { driverId });
  }, "Livreur affecté.");
}

export async function confirmPaymentAction(orderId: string): Promise<ActionState> {
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  return guard(async () => {
    const u = await requirePerm("payments.manage");
    await confirmPayment(orderId, u.id);
    await audit(u.id, "payment.confirmed", "order", orderId);
  }, "Paiement confirmé.");
}

export async function updateOrderInfoAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("orders.manage");
  const p = z.object({
    customer_name: z.string().trim().min(2).max(100), delivery_phone: z.string().transform((v) => normalizePhone(v)).refine((v) => v, "Téléphone invalide"),
    commune: z.string().trim().max(80), quartier: z.string().trim().max(100), address_line: z.string().trim().max(250), landmark: z.string().trim().max(150), instructions: z.string().trim().max(300),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const o = await one<{ status: string }>("select status from orders where id = $1", [orderId]);
  if (!o || ["delivered", "cancelled"].includes(o.status)) return { error: "Cette commande ne peut plus être modifiée." };
  const d = p.data;
  await query("update orders set customer_name=$2, delivery_phone=$3, commune=$4, quartier=$5, address_line=$6, landmark=$7, instructions=$8, updated_at=now() where id=$1", [orderId, d.customer_name, d.delivery_phone, d.commune, d.quartier, d.address_line, d.landmark || null, d.instructions || null]);
  await audit(u.id, "order.updated", "order", orderId);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Commande modifiée." };
}
