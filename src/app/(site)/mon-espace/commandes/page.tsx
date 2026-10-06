import type { Metadata } from "next";
import Link from "next/link";
import { OrderCard } from "@/components/site/OrderCard";
import { Empty, Pagination } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Mes commandes" };

export default async function Commandes({ searchParams }: { searchParams: Promise<{ f?: string; page?: string }> }) {
  const u = await requireUser("/mon-espace/commandes");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1), size = 10;
  const cond = sp.f === "cours" ? "and status not in ('delivered','cancelled')" : sp.f === "terminees" ? "and status in ('delivered','cancelled')" : "";
  const [rows, [{ n }]] = await Promise.all([
    query<any>(`select o.*, (select count(*) from order_items where order_id = o.id) as items from orders o where user_id = $1 ${cond} order by created_at desc limit ${size} offset ${(page - 1) * size}`, [u.id]),
    query<any>(`select count(*) n from orders where user_id = $1 ${cond}`, [u.id]),
  ]);
  const tabs = [["", "Toutes"], ["cours", "En cours"], ["terminees", "Terminées"]];
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Mes commandes</h1>
      <div className="flex gap-2">{tabs.map(([k, l]) => <Link key={k} href={`/mon-espace/commandes${k ? `?f=${k}` : ""}`} className={`btn btn-sm !rounded-full border-2 ${(sp.f ?? "") === k ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{l}</Link>)}</div>
      {rows.length === 0 ? <Empty icon="package" title="Aucune commande" href="/produits" cta="Commander" /> : <div className="space-y-3">{rows.map((o: any) => <OrderCard key={o.id} o={o} />)}</div>}
      <Pagination page={page} pages={Math.ceil(n / size)} href={(p) => `/mon-espace/commandes?${sp.f ? `f=${sp.f}&` : ""}page=${p}`} />
    </div>
  );
}
