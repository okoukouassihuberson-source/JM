import { NextResponse } from "next/server";
import { handleCinetpayNotification } from "@/lib/payments/cinetpay";

export const dynamic = "force-dynamic";

/** Webhook CinetPay (POST notify_url). Le statut est TOUJOURS re-vérifié côté serveur auprès de CinetPay. */
export async function POST(req: Request) {
  let id = "";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) id = String((await req.json()).cpm_trans_id ?? "");
    else id = String((await req.formData()).get("cpm_trans_id") ?? "");
  } catch { /* corps illisible */ }
  if (!/^[\w-]{6,60}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  await handleCinetpayNotification(id);
  return NextResponse.json({ ok: true });
}
// CinetPay vérifie parfois l'URL en GET.
export const GET = () => NextResponse.json({ ok: true });
