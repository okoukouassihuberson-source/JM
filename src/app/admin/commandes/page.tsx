import type { Metadata } from "next";
import Link from "next/link";
import { setStatusAction } from "@/actions/admin-orders";
import { DriverSelect } from "@/components/admin/OrderActions";
import { ActionButton } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Pagination } from "@/components/ui/bits";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";
import { displayPhone, fcfa, fmtDateTime, formatQty } from "@/lib/format";
import { PAY_STATUS_LABEL, STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";

export const metadata: Metadata = { title: "Commandes" };
const SIZE = 15;

export default async function AdminOrders({ searchParams }: { searchParams: Promise<{ statut?: string; q?: string; page?: string; paiement?: string }> }) {
  const u = await requirePage("orders.view", "/admin/commandes");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const where: string[] = [], params: any[] = [];
  if (sp.statut === "actives") where.push("o.status not in ('delivered','cancelled')");
  else if (sp.statut && sp.statut in STATUS_LABEL) { params.push(sp.statut); where.push(`o.status = $${params.length}`); }
  if (sp.paiement && ["pending", "paid", "failed", "refunded"].includes(sp.paiement)) { params.push(sp.paiement); where.push(`p.status = $${params.length}`); }
  if (sp.q?.trim()) { params.push(`%${sp.q.trim().replace(/[\\%_]/g, "\\$&")}%`); where.push(`(o.number ilike $${params.length} or o.customer_name ilike $${params.length} or o.customer_phone like $${params.length})`); }
  const W = where.length ? `where ${where.join(" and ")}` : "";
  const [rows, [{ n }], drivers] = await Promise.all([
    query<any>(`select o.*, p.status as pay_status, p.method, d.driver_id, du.first_name as df, du.last_name as dl,
        (select json_agg(json_build_object('name', oi.name, 'q', oi.quantity, 'unit', oi.unit, 'unit_label', oi.unit_label) order by oi.name) from order_items oi where oi.order_id = o.id) as items
      from orders o left join payments p on p.order_id = o.id left join deliveries d on d.order_id = o.id left join drivers dr on dr.id = d.driver_id left join users du on du.id = dr.user_id
      ${W} order by o.created_at desc limit ${SIZE} offset ${(page - 1) * SIZE}`, params),
    query<any>(`select count(*) n from orders o left join payments p on p.order_id = o.id ${W}`, params),
    query<any>("select dr.id, u.first_name || ' ' || u.last_name as name, dr.status from drivers dr join users u on u.id = dr.user_id where u.active order by u.first_name"),
  ]);
  const href = (p: number) => `/admin/commandes?${new URLSearchParams({ ...(sp.statut ? { statut: sp.statut } : {}), ...(sp.q ? { q: sp.q } : {}), ...(sp.paiement ? { paiement: sp.paiement } : {}), page: String(p) })}`;
  const canPrep = can(u, "orders.prepare"), canAssign = can(u, "orders.assign");
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">{n} résultat{n > 1 ? "s" : ""}</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Commandes</h1></div>
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <div className="relative"><Icon name="search" size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input name="q" defaultValue={sp.q} placeholder="N° de commande, client, téléphone…" className="input !pl-10" /></div>
        <select name="statut" defaultValue={sp.statut ?? ""} className="input sm:w-48"><option value="">Tous les statuts</option><option value="actives">Actives</option>{Object.entries(STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="paiement" defaultValue={sp.paiement ?? ""} className="input sm:w-40"><option value="">Paiement</option>{Object.entries(PAY_STATUS_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn-navy">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead className="border-b border-line bg-electric-50/60"><tr>{["Commande", "Client", "Produits", "Montant", "Paiement", "Adresse", "Livreur", "Statut", "Date", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((o: any) => (
              <tr key={o.id} className="hover:bg-electric-50/40">
                <td className="td font-extrabold text-navy-900"><Link href={`/admin/commandes/${o.number}`} className="hover:text-electric-500">{o.number}</Link></td>
                <td className="td"><b className="block">{o.customer_name}</b><span className="text-xs text-muted">{displayPhone(o.customer_phone)}</span></td>
                <td className="td max-w-56 text-xs text-muted">{o.items?.slice(0, 2).map((i: any) => `${i.name} ${formatQty(i.q, i)}`).join(", ")}{o.items?.length > 2 ? ` +${o.items.length - 2}` : ""}</td>
                <td className="td font-bold">{fcfa(o.total)}</td>
                <td className="td"><span className={`badge ${o.pay_status === "paid" ? "bg-success-50 text-success-600" : o.pay_status === "failed" ? "bg-promo-50 text-promo-600" : "bg-warning-50 text-warning-600"}`}>{PAY_STATUS_LABEL[o.pay_status] ?? "—"}</span><span className="block text-[11px] text-muted">{o.method === "cash_on_delivery" ? "À la livraison" : o.method === "mobile_money" ? "Mobile Money" : "En ligne"}</span></td>
                <td className="td text-xs">{o.delivery_method === "pickup" ? <span className="badge bg-slate-100 text-slate-600">Retrait</span> : <>{o.quartier}<br /><span className="text-muted">{o.zone_name?.split(" — ")[0]}</span></>}</td>
                <td className="td">{o.delivery_method === "pickup" ? "—" : o.df ? <span className="text-xs font-bold">{o.df} {o.dl[0]}.</span> : canAssign && !["delivered", "cancelled"].includes(o.status) ? <DriverSelect orderId={o.id} drivers={drivers} /> : <span className="text-xs text-muted">Non affecté</span>}</td>
                <td className="td"><span className={`badge ${STATUS_TONE[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</span></td>
                <td className="td whitespace-nowrap text-xs text-muted">{fmtDateTime(o.created_at)}</td>
                <td className="td whitespace-nowrap text-right">
                  {canPrep && (o.status === "payment_confirmed" || (o.status === "received" && o.method === "cash_on_delivery")) && <ActionButton action={setStatusAction} args={[o.id, "preparing"]} className="btn-primary btn-sm mr-1">Préparer</ActionButton>}
                  <Link href={`/admin/commandes/${o.number}`} className="btn-outline btn-sm"><Icon name="eye" size={14} /> Voir</Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} className="td py-12 text-center text-muted">Aucune commande.</td></tr>}
          </tbody>
        </table>
      </div>
      <Pagination page={page} pages={Math.ceil(n / SIZE)} href={href} />
    </div>
  );
}
