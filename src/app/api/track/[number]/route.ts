import { NextResponse } from "next/server";
import { getUser, can } from "@/lib/auth";
import { one } from "@/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Statut + position du livreur (position uniquement si le GPS temps réel est activé et la livraison en cours). */
export async function GET(_: Request, { params }: { params: Promise<{ number: string }> }) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { number } = await params;
  const staff = can(u, "orders.view");
  const r = await one<any>(
    `select o.status, o.number, d.status as delivery_status, d.eta, d.last_lat, d.last_lng, d.location_updated_at, du.first_name, du.phone
       from orders o left join deliveries d on d.order_id = o.id left join drivers dr on dr.id = d.driver_id left join users du on du.id = dr.user_id
      where o.number = $1 and ($2 or o.user_id = $3)`, [number, staff, u.id]);
  if (!r) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const s = await getSettings();
  const live = s.delivery.live_tracking_enabled && ["out_for_delivery"].includes(r.status) && r.last_lat != null;
  return NextResponse.json({
    status: r.status, delivery_status: r.delivery_status, eta: r.eta, driver: r.first_name ? { name: r.first_name, phone: r.phone } : null,
    position: live ? { lat: r.last_lat, lng: r.last_lng, updated_at: r.location_updated_at } : null,
  }, { headers: { "Cache-Control": "no-store" } });
}
