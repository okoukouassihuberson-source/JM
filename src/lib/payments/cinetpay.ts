import { one, query } from "@/db";
import { changeStatus } from "../orders";

/**
 * Intégration CinetPay (Orange Money, MTN MoMo, Moov, Wave, cartes bancaires).
 * Clés à renseigner dans .env : CINETPAY_API_KEY, CINETPAY_SITE_ID (+ CINETPAY_SECRET_KEY pour le HMAC du webhook).
 * Doc : https://docs.cinetpay.com — flux : init (payment_url) → redirection client → webhook notify_url → vérification /payment/check.
 */
const BASE = "https://api-checkout.cinetpay.com/v2";

export const cinetpayConfigured = () => !!(process.env.CINETPAY_API_KEY && process.env.CINETPAY_SITE_ID);

export async function initCinetpay(order: { id: string; number: string; total: number; customer_name: string; customer_phone: string }): Promise<string> {
  if (!cinetpayConfigured()) throw new Error("Paiement en ligne non configuré (clés CinetPay manquantes).");
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
  const transaction_id = `${order.number}-${Date.now().toString(36)}`.slice(0, 40);
  const res = await fetch(`${BASE}/payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      apikey: process.env.CINETPAY_API_KEY, site_id: process.env.CINETPAY_SITE_ID, transaction_id,
      amount: Math.ceil(order.total / 5) * 5, // CinetPay exige un multiple de 5 (XOF)
      currency: "XOF", channels: "ALL", lang: "fr",
      description: `Commande ${order.number}`,
      customer_name: order.customer_name, customer_surname: "-", customer_phone_number: `+${order.customer_phone}`,
      notify_url: `${site}/api/payments/cinetpay`, return_url: `${site}/mon-espace/commandes/${order.number}`,
    }),
  });
  const json: any = await res.json().catch(() => ({}));
  const url = json?.data?.payment_url;
  if (json?.code !== "201" || !url) throw new Error(json?.message || "Impossible d'initialiser le paiement.");
  await query("update payments set provider_ref = $2 where order_id = $1", [order.id, transaction_id]);
  return url as string;
}

/** Appelé par le webhook : on ne fait JAMAIS confiance au corps reçu, on re-vérifie auprès de CinetPay. */
export async function handleCinetpayNotification(transactionId: string): Promise<boolean> {
  if (!cinetpayConfigured() || !transactionId) return false;
  const pay = await one<any>("select p.order_id, p.amount, p.status from payments p where p.provider_ref = $1", [transactionId]);
  if (!pay) return false;
  const res = await fetch(`${BASE}/payment/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apikey: process.env.CINETPAY_API_KEY, site_id: process.env.CINETPAY_SITE_ID, transaction_id: transactionId }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (json?.data?.status === "ACCEPTED" && Number(json.data.amount) >= pay.amount) {
    if (pay.status !== "paid") {
      const o = await one<{ status: string }>("select status from orders where id = $1", [pay.order_id]);
      if (o?.status === "received") await changeStatus(pay.order_id, "payment_confirmed", null, "Paiement en ligne confirmé (CinetPay)");
      else await query("update payments set status = 'paid', paid_at = now() where order_id = $1", [pay.order_id]);
    }
    return true;
  }
  if (json?.data?.status === "REFUSED") await query("update payments set status = 'failed' where order_id = $1 and status = 'pending'", [pay.order_id]);
  return false;
}
