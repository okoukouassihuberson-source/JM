"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query } from "@/db";
import { audit } from "@/lib/audit";
import { requirePerm } from "@/lib/auth";
import { driverAccept, driverArrived, driverDeliver, driverEnRoute, driverFail, OrderError } from "@/lib/orders";
import { saveImage, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/components/ui/ActionForm";

const uuid = z.string().uuid();

async function run(fn: (userId: string) => Promise<void>, ok: string): Promise<ActionState> {
  const u = await requirePerm("driver.access");
  try {
    await fn(u.id);
  } catch (e) {
    if (e instanceof OrderError || e instanceof UploadError) return { error: e.message };
    throw e;
  }
  revalidatePath("/livreur");
  return { ok: true, message: ok };
}

export const acceptAction = async (orderId: string) => uuid.safeParse(orderId).success ? run((u) => driverAccept(u, orderId), "Course acceptée.") : { error: "Requête invalide." };
export const enRouteAction = async (orderId: string) => uuid.safeParse(orderId).success ? run((u) => driverEnRoute(u, orderId), "En route ! Bonne livraison.") : { error: "Requête invalide." };
export const arrivedAction = async (orderId: string) => uuid.safeParse(orderId).success ? run((u) => driverArrived(u, orderId), "Le client est prévenu de votre arrivée.") : { error: "Requête invalide." };

export async function deliverAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  return run(async (u) => {
    const photo = fd.get("photo");
    const photoUrl = photo instanceof File && photo.size > 0 ? await saveImage(photo, 1200) : null;
    await driverDeliver(u, orderId, { code: String(fd.get("code") ?? ""), comment: String(fd.get("comment") ?? "").slice(0, 300), photoUrl });
    await audit(u, "delivery.completed", "order", orderId);
  }, "Livraison confirmée. Merci !");
}

export async function failAction(orderId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  if (!uuid.safeParse(orderId).success) return { error: "Requête invalide." };
  return run((u) => driverFail(u, orderId, String(fd.get("reason") ?? "").slice(0, 300)), "Échec enregistré. Le gérant est prévenu.");
}

export async function setAvailabilityAction(available: boolean): Promise<ActionState> {
  const u = await requirePerm("driver.access");
  const busy = await one("select 1 from deliveries d join drivers dr on dr.id = d.driver_id where dr.user_id = $1 and d.status in ('en_route','arrived')", [u.id]);
  if (busy) return { error: "Terminez votre livraison en cours d'abord." };
  await query("update drivers set status = $2 where user_id = $1", [u.id, available ? "available" : "unavailable"]);
  revalidatePath("/livreur");
  return { ok: true, message: available ? "Vous êtes disponible." : "Vous êtes indisponible." };
}
