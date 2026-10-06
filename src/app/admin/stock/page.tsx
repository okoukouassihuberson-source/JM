import type { Metadata } from "next";
import { StockRow } from "@/components/admin/StockRow";
import { Icon } from "@/components/ui/Icon";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";
import { fmtDateTime, num } from "@/lib/format";

export const metadata: Metadata = { title: "Stock" };

const TYPE: Record<string, string> = { restock: "Réception", reserve: "Réservation", release: "Libération", sale: "Vente", adjustment: "Correction", loss: "Perte / casse", initial: "Stock initial" };

export default async function Stock({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const u = await requirePage("stock.view", "/admin/stock");
  const sp = await searchParams;
  const rows = await query<any>(
    `select p.id, p.name, p.unit, p.unit_label, p.active, c.name as category, i.on_hand, i.reserved, i.sold, i.alert_threshold, i.on_hand - i.reserved as available
       from inventory i join products p on p.id = i.product_id join categories c on c.id = p.category_id
      ${sp.f === "faible" ? "where i.on_hand - i.reserved <= i.alert_threshold" : ""} order by (i.on_hand - i.reserved <= i.alert_threshold) desc, p.name`);
  const moves = await query<any>("select m.*, p.name, p.unit_label, u.first_name from inventory_movements m join products p on p.id = m.product_id left join users u on u.id = m.user_id order by m.created_at desc, m.id desc limit 12");
  const low = rows.filter((r) => r.available <= r.alert_threshold).length;
  const manage = can(u, "stock.manage");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Produits frais — suivi en temps réel</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Gestion du stock</h1></div>
        <div className="flex gap-2"><a href="/admin/stock" className={`btn btn-sm !rounded-full border-2 ${sp.f ? "border-line bg-white" : "border-navy-900 bg-navy-900 text-white"}`}>Tout</a><a href="/admin/stock?f=faible" className={`btn btn-sm !rounded-full border-2 ${sp.f ? "border-warning-600 bg-warning-600 text-white" : "border-line bg-white"}`}><Icon name="alert" size={14} /> Stock faible ({low})</a></div></div>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Produit", "En rayon", "Réservé", "Vendu (cumul)", "Restant dispo.", "Seuil d'alerte", manage ? "Mouvement" : ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((r) => <StockRow key={r.id} r={r} manage={manage} />)}</tbody></table>
      </div>
      <section className="card p-5"><h2 className="h-display mb-3 text-2xl text-navy-900">Derniers mouvements</h2>
        <ul className="divide-y divide-line text-sm">{moves.map((m: any) => <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span><b>{m.name}</b> <span className="text-muted">— {TYPE[m.type]}{m.note ? ` · ${m.note}` : ""}</span></span><span className="flex items-center gap-3"><b className={m.on_hand_delta > 0 ? "text-success-600" : m.on_hand_delta < 0 ? "text-promo-600" : "text-muted"}>{m.on_hand_delta ? `${m.on_hand_delta > 0 ? "+" : ""}${num(m.on_hand_delta)}` : `réservé ${m.reserved_delta > 0 ? "+" : ""}${num(m.reserved_delta)}`} {m.unit_label}</b><span className="text-xs text-muted">{fmtDateTime(m.created_at)}{m.first_name ? ` · ${m.first_name}` : ""}</span></span></li>)}</ul></section>
    </div>
  );
}
