"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { createOrder, OrderError } from "@/lib/orders";
import { rateLimit } from "@/lib/security";
import { cinetpayConfigured } from "@/lib/payments/cinetpay";
import { getSettings } from "@/lib/settings";
import type { ActionState } from "@/components/ui/ActionForm";

const schema = z.object({
  customerName: z.string().trim().min(3, "Nom complet requis").max(100),
  customerPhone: z.string().transform((v) => normalizePhone(v)).refine((v): v is string => !!v, "Téléphone invalide"),
  method: z.enum(["standard", "express", "pickup"]),
  zoneId: z.string().uuid().nullable().or(z.literal("").transform(() => null)),
  commune: z.string().trim().max(80), quartier: z.string().trim().max(100), address: z.string().trim().max(250), landmark: z.string().trim().max(150),
  deliveryPhone: z.string().trim().max(30), instructions: z.string().trim().max(300),
  paymentMethod: z.enum(["cash_on_delivery", "mobile_money", "online"]),
  paymentReference: z.string().trim().max(40), saveAddress: z.string().optional(),
});

export async function placeOrderAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser("/commande");
  const p = schema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (!(await rateLimit(`order:${u.id}`, 10, 3600))) return { error: "Trop de commandes en peu de temps. Réessayez plus tard." };
  if (d.method !== "pickup" && (!d.zoneId || d.commune.length < 2 || d.quartier.length < 2 || d.address.length < 3))
    return { error: "Renseignez la zone, la commune, le quartier et l'adresse de livraison." };
  if (d.paymentMethod === "online" && !(cinetpayConfigured() && (await getSettings()).payment.cinetpay)) return { error: "Le paiement en ligne n'est pas disponible." };
  let number: string;
  try {
    ({ number } = await createOrder({
      userId: u.id, customerName: d.customerName, customerPhone: d.customerPhone, method: d.method, zoneId: d.method === "pickup" ? null : d.zoneId,
      commune: d.commune, quartier: d.quartier, address: d.address, landmark: d.landmark,
      deliveryPhone: normalizePhone(d.deliveryPhone) ?? d.customerPhone, instructions: d.instructions,
      paymentMethod: d.paymentMethod, paymentReference: d.paymentReference, saveAddress: !!d.saveAddress,
    }));
  } catch (e) {
    if (e instanceof OrderError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/mon-espace/commandes/${number}?nouveau=1`);
}
