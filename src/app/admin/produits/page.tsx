import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { deleteProductAction, toggleProductAction } from "@/actions/admin-catalog";
import { PriceEditor } from "@/components/admin/PriceEditor";
import { ActionButton } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge, Pagination } from "@/components/ui/bits";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";
import { fcfa, num } from "@/lib/format";
import { promoLive } from "@/lib/pricing";

export const metadata: Metadata = { title: "Produits" };
const SIZE = 20;

export default async function AdminProducts({ searchParams }: { searchParams: Promise<{ q?: string; cat?: string; page?: string; etat?: string }> }) {
  const u = await requirePage("products.view", "/admin/produits");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const where: string[] = [], params: any[] = [];
  if (sp.q?.trim()) { params.push(`%${sp.q.trim().replace(/[\\%_]/g, "\\$&")}%`); where.push(`unaccent_ci(p.name) like unaccent_ci($${params.length})`); }
  if (sp.cat && /^[0-9a-f-]{36}$/.test(sp.cat)) { params.push(sp.cat); where.push(`p.category_id = $${params.length}`); }
  if (sp.etat === "inactifs") where.push("not p.active"); else if (sp.etat === "promo") where.push("p.promo_active"); else if (sp.etat === "vedettes") where.push("p.featured");
  const W = where.length ? "where " + where.join(" and ") : "";
  const [rows, [{ n }], cats] = await Promise.all([
    query<any>(`select p.*, c.name as category_name, (select url from product_images i where i.product_id = p.id order by position limit 1) as image, coalesce(inv.on_hand - inv.reserved, 0) as available, coalesce(inv.alert_threshold, 0) as thr
      from products p join categories c on c.id = p.category_id left join inventory inv on inv.product_id = p.id ${W} order by p.created_at desc, p.name limit ${SIZE} offset ${(page - 1) * SIZE}`, params),
    query<any>(`select count(*) n from products p ${W}`, params),
    query<any>("select id, name from categories order by sort_order"),
  ]);
  const manage = can(u, "products.manage");
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">{n} produit{n > 1 ? "s" : ""}</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Produits</h1></div>
        {manage && <Link href="/admin/produits/nouveau" className="btn-primary"><Icon name="plus" size={18} /> Ajouter un produit</Link>}</div>
      <form className="card grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto_auto]">
        <input name="q" defaultValue={sp.q} placeholder="Rechercher un produit…" className="input" />
        <select name="cat" defaultValue={sp.cat ?? ""} className="input sm:w-48"><option value="">Toutes catégories</option>{cats.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="etat" defaultValue={sp.etat ?? ""} className="input sm:w-40"><option value="">Tous</option><option value="inactifs">Inactifs</option><option value="promo">En promotion</option><option value="vedettes">Vedettes</option></select>
        <button className="btn-navy">Filtrer</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[900px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Produit", "Catégorie", "Prix", "Stock dispo", "Statut", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">{rows.map((p: any) => {
            const live = promoLive(p);
            return (
              <tr key={p.id} className={p.active ? "" : "bg-slate-50 opacity-70"}>
                <td className="td"><div className="flex items-center gap-3"><span className="relative size-12 shrink-0 overflow-hidden rounded-xl bg-electric-50">{p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}</span><div><Link href={`/admin/produits/${p.id}`} className="font-extrabold text-navy-900 hover:text-electric-500">{p.name}</Link><p className="text-xs text-muted">{p.sku} · {p.unit === "kg" ? "au kg" : p.unit_label}</p></div></div></td>
                <td className="td">{p.category_name}</td>
                <td className="td">{manage ? <PriceEditor id={p.id} price={p.price} /> : <b>{fcfa(p.price)}</b>}{live && <p className="text-xs font-bold text-promo-600">Promo : {fcfa(p.promo_price)}</p>}</td>
                <td className="td"><span className={`font-bold ${p.available <= 0 ? "text-promo-600" : p.available <= p.thr ? "text-warning-600" : "text-success-600"}`}>{num(p.available)} {p.unit_label}</span></td>
                <td className="td"><div className="flex flex-wrap gap-1">{p.active ? <Badge tone="green">Actif</Badge> : <Badge tone="gray">Inactif</Badge>}{p.featured && <Badge tone="blue">Vedette</Badge>}{live && <Badge tone="red">Promo</Badge>}</div></td>
                <td className="td whitespace-nowrap text-right">{manage && <div className="flex justify-end gap-1">
                  <ActionButton action={toggleProductAction} args={[p.id, "featured"]} className="btn-outline btn-sm" ><Icon name="star" size={14} /></ActionButton>
                  <ActionButton action={toggleProductAction} args={[p.id, "active"]} className="btn-outline btn-sm">{p.active ? "Désactiver" : "Activer"}</ActionButton>
                  <Link href={`/admin/produits/${p.id}`} className="btn-navy btn-sm"><Icon name="edit" size={14} /></Link>
                  <ActionButton action={deleteProductAction} args={[p.id]} confirm={`Supprimer définitivement « ${p.name} » ?`} className="btn-danger btn-sm"><Icon name="trash" size={14} /></ActionButton></div>}</td>
              </tr>);
          })}</tbody></table>
      </div>
      <Pagination page={page} pages={Math.ceil(n / SIZE)} href={(p) => `/admin/produits?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.cat ? { cat: sp.cat } : {}), ...(sp.etat ? { etat: sp.etat } : {}), page: String(p) })}`} />
    </div>
  );
}
