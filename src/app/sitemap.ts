import type { MetadataRoute } from "next";
import { query } from "@/db";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, cats] = await Promise.all([
    query<{ slug: string; updated_at: Date }>("select slug, updated_at from products where active"),
    query<{ slug: string }>("select slug from categories where active"),
  ]);
  const now = new Date();
  return [
    ...["", "/produits", "/promotions", "/a-propos", "/livraison", "/contact"].map((p) => ({ url: `${SITE}${p}`, lastModified: now, changeFrequency: "daily" as const, priority: p === "" ? 1 : 0.8 })),
    ...cats.map((c) => ({ url: `${SITE}/produits?categorie=${c.slug}`, lastModified: now, changeFrequency: "daily" as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${SITE}/produits/${p.slug}`, lastModified: p.updated_at, changeFrequency: "daily" as const, priority: 0.6 })),
  ];
}
