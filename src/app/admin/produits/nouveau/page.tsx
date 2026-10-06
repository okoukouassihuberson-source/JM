import type { Metadata } from "next";
import Link from "next/link";
import { ProductForm } from "@/components/admin/ProductForm";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Nouveau produit" };

export default async function NewProduct() {
  const u = await requirePage("products.manage", "/admin/produits/nouveau");
  const cats = await query<any>("select id, name from categories order by sort_order, name");
  return (
    <div className="space-y-5">
      <div><Link href="/admin/produits" className="text-xs font-bold text-electric-500">← Produits</Link><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Nouveau produit</h1></div>
      <ProductForm categories={cats} canStock={can(u, "stock.manage")} />
    </div>
  );
}
