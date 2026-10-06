import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/admin/ProductForm";
import { query, one } from "@/db";
import { can, requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Modifier le produit" };

export default async function EditProduct({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ cree?: string }> }) {
  const { id } = await params;
  const u = await requirePage("products.manage", `/admin/produits/${id}`);
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const p = await one<any>("select * from products where id = $1", [id]);
  if (!p) notFound();
  const [cats, images, variants, inv] = await Promise.all([
    query<any>("select id, name from categories order by sort_order, name"),
    query<any>("select id, url from product_images where product_id = $1 order by position, id", [id]),
    query<any>("select name, price from product_variants where product_id = $1 order by position", [id]),
    one<any>("select on_hand, reserved, alert_threshold from inventory where product_id = $1", [id]),
  ]);
  return (
    <div className="space-y-5">
      <div><Link href="/admin/produits" className="text-xs font-bold text-electric-500">← Produits</Link><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">{p.name}</h1>
        {(await searchParams).cree && <p className="mt-2 rounded-xl bg-success-50 px-3 py-2 text-sm font-bold text-success-600">Produit créé avec succès.</p>}
        <Link href={`/produits/${p.slug}`} target="_blank" className="text-sm font-bold text-electric-500">Voir sur la boutique ↗</Link></div>
      <ProductForm p={p} categories={cats} images={images} variants={variants} inv={inv} canStock={can(u, "stock.manage")} />
    </div>
  );
}
