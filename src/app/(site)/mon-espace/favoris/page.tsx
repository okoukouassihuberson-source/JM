import type { Metadata } from "next";
import { ProductCard } from "@/components/ProductCard";
import { Empty } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { listProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Mes favoris" };

export default async function Favoris() {
  const u = await requireUser("/mon-espace/favoris");
  const ids = (await query<{ product_id: string }>("select product_id from favorites where user_id = $1 order by created_at desc", [u.id])).map((r) => r.product_id);
  const { items } = ids.length ? await listProducts({ ids, pageSize: 60 }) : { items: [] };
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Mes favoris</h1>
      {items.length === 0 ? <Empty icon="heart" title="Pas encore de favoris" text="Touchez le cœur sur un produit pour le retrouver ici (et être prévenu de son retour en stock)." href="/produits" cta="Parcourir les produits" />
        : <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-3">{items.map((p, i) => <ProductCard key={p.id} p={p} fav index={i} />)}</div>}
    </div>
  );
}
