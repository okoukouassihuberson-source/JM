import { NextResponse } from "next/server";
import { one } from "@/db";
import { can, getUser } from "@/lib/auth";
import { renderInvoice } from "@/lib/invoice-pdf";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ number: string }> }) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "Connexion requise" }, { status: 401 });
  const { number } = await params;
  const staff = can(u, "orders.view");
  const inv = await one<any>(
    `select i.number, i.issued_at, i.data, p.status as pay_status, p.method, p.reference
       from invoices i join orders o on o.id = i.order_id left join payments p on p.order_id = o.id
      where o.number = $1 and ($2 or o.user_id = $3)`, [number, staff, u.id]);
  if (!inv) return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  const pdf = await renderInvoice(inv, { status: inv.pay_status ?? "pending", method: inv.method ?? inv.data.payment_method, reference: inv.reference });
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${inv.number}.pdf"`, "Cache-Control": "private, no-store" } });
}
