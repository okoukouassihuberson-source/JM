import webpush from "web-push";
import { query } from "@/db";

export const pushEnabled = () => !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function init() {
  if (ready) return true;
  if (!pushEnabled()) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:contact@example.com", process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  return (ready = true);
}

export type PushPayload = { title: string; body?: string; link?: string; tag?: string };

/** Envoie une notification push à tous les appareils d'un utilisateur (échec silencieux, abonnements expirés nettoyés). */
export async function sendPush(userId: string, p: PushPayload): Promise<number> {
  if (!init()) return 0;
  const subs = await query<{ id: string; endpoint: string; p256dh: string; auth: string }>("select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1", [userId]);
  let sent = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(p), { TTL: 3600, urgency: "high" });
      sent++;
    } catch (e: any) {
      if (e.statusCode === 404 || e.statusCode === 410) await query("delete from push_subscriptions where id = $1", [s.id]);
      else console.error("push: échec d'envoi", e.statusCode ?? e.message);
    }
  }));
  return sent;
}
