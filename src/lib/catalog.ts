import { cache } from "react";
import { query, one } from "@/db";
import { unitPrice, type PricedProduct } from "./pricing";

export type ProductRow = PricedProduct & {
  id: string; slug: string; name: string; description: string; category_id: string; category_name: string; category_slug: string;
  unit: string; unit_label: string; step: number; min_qty: number; allow_custom_qty: boolean;
  active: boolean; featured: boolean; image: string | null; rating: number; review_count: number;
  available: number; alert_threshold: number; created_at: Date; has_variants: boolean;
};

const SELECT = `
  select p.*, c.name as category_name, c.slug as category_slug,
    (select url from product_images i where i.product_id = p.id order by position, id limit 1) as image,
    coalesce((select round(avg(rating)::numeric, 1) from reviews r where r.product_id = p.id and r.status = 'published'), 0) as rating,
    (select count(*) from reviews r where r.product_id = p.id and r.status = 'published') as review_count,
    coalesce(inv.on_hand - inv.reserved, 0) as available, coalesce(inv.alert_threshold, 0) as alert_threshold,
    exists (select 1 from product_variants v where v.product_id = p.id and v.active) as has_variants
  from products p
  join categories c on c.id = p.category_id
  left join inventory inv on inv.product_id = p.id`;

export type ProductFilter = {
  q?: string; category?: string; sort?: string; promo?: boolean; featured?: boolean; page?: number; pageSize?: number; ids?: string[];
};

export async function listProducts(f: ProductFilter = {}): Promise<{ items: ProductRow[]; total: number }> {
  const where = ["p.active", "c.active"];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replaceAll("?", `$${params.length}`)); };
  if (f.q) add("(unaccent_ci(p.name) like unaccent_ci(?) or unaccent_ci(c.name) like unaccent_ci(?))", `%${f.q.replace(/[\\%_]/g, "\\$&")}%`);
  if (f.category) add("c.slug = ?", f.category);
  if (f.promo) where.push("p.promo_active and p.promo_price is not null and (p.promo_ends_at is null or p.promo_ends_at > now())");
  if (f.featured) where.push("p.featured");
  if (f.ids) add("p.id = any(?::uuid[])", f.ids);
  const order = {
    prix_asc: "p.price asc", prix_desc: "p.price desc", nom: "p.name asc", note: "rating desc, review_count desc",
  }[f.sort ?? ""] ?? "p.featured desc, c.sort_order, p.name";
  const size = f.pageSize ?? 12, offset = ((f.page ?? 1) - 1) * size;
  const items = await query<ProductRow>(`${SELECT} where ${where.join(" and ")} order by ${order} limit ${size} offset ${offset}`, params);
  const [{ n }] = await query<{ n: number }>(`select count(*) n from products p join categories c on c.id = p.category_id where ${where.join(" and ")}`, params);
  return { items, total: n };
}

export const getProduct = cache(async (slug: string) => {
  const p = await one<ProductRow>(`${SELECT} where p.slug = $1 and p.active and c.active`, [slug]);
  if (!p) return null;
  const [images, variants] = await Promise.all([
    query<{ id: string; url: string; alt: string }>("select id, url, alt from product_images where product_id = $1 order by position, id", [p.id]),
    query<{ id: string; name: string; price: number }>("select id, name, price from product_variants where product_id = $1 and active order by position, price", [p.id]),
  ]);
  return { ...p, images, variants };
});

export async function listCategories(all = false) {
  return query<{ id: string; slug: string; name: string; description: string; image_url: string | null; product_count: number; active: boolean }>(
    `select c.id, c.slug, c.name, c.description, c.image_url, c.active,
            (select count(*) from products p where p.category_id = c.id and p.active) as product_count
       from categories c ${all ? "" : "where c.active"} order by c.sort_order, c.name`,
  );
}

export async function categoryNamesInfo() {
  return listCategories();
}

export const stockLabel = (p: Pick<ProductRow, "available" | "alert_threshold">) =>
  p.available <= 0 ? ("out" as const) : p.available <= p.alert_threshold ? ("low" as const) : ("ok" as const);

export const priceOf = (p: ProductRow) => unitPrice(p);

import { getUser } from "./auth";
/** Ids des produits favoris de l'utilisateur connecté (vide sinon). */
export async function favoriteIds(): Promise<Set<string>> {
  const u = await getUser();
  if (!u) return new Set();
  return new Set((await query<{ product_id: string }>("select product_id from favorites where user_id = $1", [u.id])).map((r) => r.product_id));
}

export async function latestReviews(limit = 3) {
  return query<{ id: string; rating: number; comment: string; created_at: Date; first_name: string; last_name: string; product_name: string; slug: string }>(
    `select r.id, r.rating, r.comment, r.created_at, u.first_name, u.last_name, p.name as product_name, p.slug
       from reviews r join users u on u.id = r.user_id join products p on p.id = r.product_id
      where r.status = 'published' and r.rating >= 4 and length(r.comment) > 10 order by r.created_at desc limit $1`, [limit]);
}
