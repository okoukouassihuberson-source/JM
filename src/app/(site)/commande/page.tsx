import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CheckoutForm } from "@/components/CheckoutForm";
import { PageTitle } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { getCart } from "@/lib/cart";
import { displayPhone, formatQty } from "@/lib/format";
import { cinetpayConfigured } from "@/lib/payments/cinetpay";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Valider ma commande", robots: { index: false } };

export default async function Checkout() {
  const user = await requireUser("/commande");
  const [cart, s, zones, addresses] = await Promise.all([
    getCart(), getSettings(),
    query<any>("select id, name, description, fee, eta_min, eta_max from delivery_zones where active order by sort_order, fee"),
    query<any>("select id, label, commune, quartier, address, landmark, phone, instructions, is_default from addresses where user_id = $1 order by is_default desc, created_at", [user.id]),
  ]);
  if (!cart.lines.length) redirect("/panier");
  if (!cart.valid) redirect("/panier");
  const today = s.hours[(new Date().getDay() + 6) % 7];
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageTitle eyebrow="Finalisation" title="Valider ma commande" />
      <CheckoutForm
        user={{ name: `${user.first_name} ${user.last_name}`, phone: displayPhone(user.phone) }}
        cart={{ subtotal: cart.subtotal, discount: cart.discount, lines: cart.lines.map((l) => ({ id: l.id, name: l.variant_name ? `${l.name} (${l.variant_name})` : l.name, qty: formatQty(l.quantity, l), total: l.line_total })) }}
        zones={zones} addresses={addresses}
        opts={{
          expressSupplement: s.delivery.express_supplement, freeThreshold: s.delivery.free_delivery_threshold, expressEnabled: s.delivery.express_enabled, pickupEnabled: s.delivery.pickup_enabled,
          cod: s.payment.cash_on_delivery, momo: s.payment.mobile_money_manual, momoInfo: s.payment.mobile_money_numbers, online: s.payment.cinetpay && cinetpayConfigured(),
          shopAddress: [s.contact.address, s.contact.city].filter(Boolean).join(", "), hours: today && !today.closed ? `Ouvert aujourd'hui ${today.open}–${today.close}.` : "",
        }}
      />
    </div>
  );
}
