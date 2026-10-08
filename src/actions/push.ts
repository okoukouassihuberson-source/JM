"use server";
import { z } from "zod";
import { headers } from "next/headers";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { pushEnabled, sendPush } from "@/lib/push";
import type { ActionState } from "@/components/ui/ActionForm";

const sub = z.object({ endpoint: z.string().url().max(1000).startsWith("https://"), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

/** Enregistre l'appareil de l'utilisateur connecté pour recevoir les notifications push. */
export async function savePushSubscriptionAction(subscription: unknown): Promise<ActionState> {
  const u = await requireUser();
  const p = sub.safeParse(subscription);
  if (!p.success) return { error: "Abonnement invalide." };
  const ua = (await headers()).get("user-agent")?.slice(0, 200) ?? null;
  await query(
    `insert into push_subscriptions(user_id, endpoint, p256dh, auth, user_agent) values ($1,$2,$3,$4,$5)
     on conflict (endpoint) do update set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth, user_agent = excluded.user_agent`,
    [u.id, p.data.endpoint, p.data.keys.p256dh, p.data.keys.auth, ua]);
  return { ok: true, message: "Alertes activées sur cet appareil." };
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionState> {
  const u = await requireUser();
  await query("delete from push_subscriptions where user_id = $1 and endpoint = $2", [u.id, endpoint]);
  return { ok: true, message: "Alertes désactivées sur cet appareil." };
}

export async function sendTestPushAction(): Promise<ActionState> {
  const u = await requireUser();
  if (!pushEnabled()) return { error: "Les notifications push ne sont pas configurées sur le serveur (clés VAPID manquantes)." };
  const n = await sendPush(u.id, { title: "Test JM Poissonnerie", body: "Les alertes fonctionnent sur cet appareil ✅", link: "/livreur", tag: "test" });
  return n > 0 ? { ok: true, message: `Notification envoyée à ${n} appareil(s).` } : { error: "Aucun appareil abonné. Activez d'abord les alertes." };
}
