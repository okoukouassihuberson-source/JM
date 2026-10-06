"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { one, query, tx } from "@/db";
import { audit } from "@/lib/audit";
import { requirePerm } from "@/lib/auth";
import { slugify } from "@/lib/format";
import { adjustStock, StockError } from "@/lib/inventory";
import { saveImage, saveImages, UploadError } from "@/lib/uploads";
import { can } from "@/lib/auth";
import type { ActionState } from "@/components/ui/ActionForm";

const uuid = z.string().uuid();
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true" || v === "1";
const refresh = () => { revalidatePath("/", "layout"); };
const num = z.coerce.number();

const productSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120), category_id: uuid, description: z.string().trim().max(3000),
  unit: z.enum(["kg", "piece", "pack", "tray", "custom"]), unit_label: z.string().trim().min(1, "Libellé d'unité requis").max(20),
  step: num.positive("Pas invalide").max(1000), min_qty: num.positive("Quantité minimale invalide").max(1000),
  price: num.int("Prix entier requis").min(0).max(10_000_000),
  promo_price: z.string().trim().optional(), promo_ends_at: z.string().optional(),
  stock: z.string().trim().optional(), alert_threshold: z.string().trim().optional(),
  variants: z.string().max(1500).optional(),
});

function parseVariants(text: string): { name: string; price: number }[] | string {
  const out: { name: string; price: number }[] = [];
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    const [name, price] = line.split("|").map((s) => s.trim());
    const p = Number(price?.replace(/\s/g, ""));
    if (!name || !Number.isInteger(p) || p < 0) return `Variante invalide : « ${line} » (format : Nom | prix)`;
    out.push({ name: name.slice(0, 60), price: p });
  }
  return out.slice(0, 12);
}

export async function saveProductAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("products.manage");
  const p = productSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const promoActive = bool(fd.get("promo_active"));
  const promoPrice = d.promo_price ? Number(d.promo_price) : null;
  if (promoActive && (promoPrice == null || !Number.isInteger(promoPrice) || promoPrice < 0 || promoPrice >= d.price)) return { error: "Le prix promotionnel doit être un entier inférieur au prix normal." };
  const variants = parseVariants(d.variants ?? "");
  if (typeof variants === "string") return { error: variants };
  const stock = d.stock ? Number(d.stock.replace(",", ".")) : null, thr = d.alert_threshold ? Number(d.alert_threshold.replace(",", ".")) : null;
  if ((stock != null && (!Number.isFinite(stock) || stock < 0)) || (thr != null && (!Number.isFinite(thr) || thr < 0))) return { error: "Stock / seuil invalide." };

  let urls: string[] = [];
  try { urls = await saveImages(fd.getAll("photos") as File[], 6); } catch (e) { if (e instanceof UploadError) return { error: e.message }; throw e; }

  let pid = id;
  try {
    await tx(async (c) => {
      const fields = [d.category_id, d.name, d.description, d.unit, d.unit_label, d.step, d.min_qty, bool(fd.get("allow_custom_qty")), d.price, promoActive ? promoPrice : promoPrice, promoActive, d.promo_ends_at ? new Date(d.promo_ends_at + "T23:59:59") : null, bool(fd.get("active")), bool(fd.get("featured"))];
      if (id) {
        await query(`update products set category_id=$2, name=$3, description=$4, unit=$5, unit_label=$6, step=$7, min_qty=$8, allow_custom_qty=$9, price=$10, promo_price=$11, promo_active=$12, promo_ends_at=$13, active=$14, featured=$15, updated_at=now() where id=$1`, [id, ...fields], c);
      } else {
        let slug = slugify(d.name);
        if (await one("select 1 from products where slug = $1", [slug], c)) slug += "-" + Math.random().toString(36).slice(2, 6);
        pid = (await one<{ id: string }>(`insert into products(category_id, name, description, unit, unit_label, step, min_qty, allow_custom_qty, price, promo_price, promo_active, promo_ends_at, active, featured, slug) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`, [...fields, slug], c))!.id;
        await query("insert into inventory(product_id) values ($1)", [pid], c);
      }
      // Stock : réservé au droit stock.manage
      if (can(u, "stock.manage")) {
        if (thr != null) await query("update inventory set alert_threshold = $2, updated_at = now() where product_id = $1", [pid, thr], c);
        if (stock != null) {
          const cur = (await one<{ on_hand: number }>("select on_hand from inventory where product_id = $1", [pid], c))!.on_hand;
          if (stock !== cur) await adjustStock(c, pid!, id ? "adjustment" : "initial", Math.round((stock - cur) * 1000) / 1000, u.id, "Fiche produit");
        }
      }
      // Photos
      const rm = fd.getAll("remove_image").map(String).filter((x) => uuid.safeParse(x).success);
      if (rm.length) await query("delete from product_images where product_id = $1 and id = any($2::uuid[])", [pid, rm], c);
      const pos = (await one<{ m: number }>("select coalesce(max(position), -1) m from product_images where product_id = $1", [pid], c))!.m;
      for (const [i, url] of urls.entries()) await query("insert into product_images(product_id, url, alt, position) values ($1,$2,$3,$4)", [pid, url, `${d.name} — JM Poissonnerie`, pos + 1 + i], c);
      const main = String(fd.get("main_image") ?? "");
      if (uuid.safeParse(main).success) { await query("update product_images set position = position + 1 where product_id = $1", [pid], c); await query("update product_images set position = 0 where id = $1 and product_id = $2", [main, pid], c); }
      // Variantes (remplacement simple ; les commandes conservent leur instantané)
      await query("delete from product_variants where product_id = $1", [pid], c);
      for (const [i, v] of variants.entries()) await query("insert into product_variants(product_id, name, price, position) values ($1,$2,$3,$4)", [pid, v.name, v.price, i], c);
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  await audit(u.id, id ? "product.updated" : "product.created", "product", pid!, { name: d.name, price: d.price });
  refresh();
  if (!id) redirect(`/admin/produits/${pid}?cree=1`);
  return { ok: true, message: "Produit enregistré." };
}

export async function toggleProductAction(id: string, field: "active" | "featured"): Promise<ActionState> {
  const u = await requirePerm("products.manage");
  if (!uuid.safeParse(id).success) return { error: "Requête invalide." };
  const col = field === "active" ? "active" : "featured";
  const r = await one<{ v: boolean }>(`update products set ${col} = not ${col}, updated_at = now() where id = $1 returning ${col} as v`, [id]);
  await audit(u.id, `product.${field}`, "product", id, { value: r?.v });
  refresh();
  return { ok: true, message: field === "active" ? (r?.v ? "Produit activé." : "Produit désactivé.") : (r?.v ? "Mis en vedette." : "Retiré des vedettes.") };
}

export async function deleteProductAction(id: string): Promise<ActionState> {
  const u = await requirePerm("products.manage");
  if (!uuid.safeParse(id).success) return { error: "Requête invalide." };
  const p = await one<{ name: string }>("delete from products where id = $1 returning name", [id]);
  await audit(u.id, "product.deleted", "product", id, { name: p?.name });
  refresh();
  return { ok: true, message: "Produit supprimé." };
}

export async function quickPriceAction(id: string, price: number): Promise<ActionState> {
  const u = await requirePerm("products.manage");
  if (!uuid.safeParse(id).success || !Number.isInteger(price) || price < 0 || price > 10_000_000) return { error: "Prix invalide." };
  const r = await query("update products set price = $2, promo_active = case when promo_price >= $2 then false else promo_active end, updated_at = now() where id = $1 returning id", [id, price]);
  if (!r.length) return { error: "Produit introuvable." };
  await audit(u.id, "product.price", "product", id, { price });
  refresh();
  return { ok: true, message: "Prix mis à jour." };
}

// ───────────── Catégories ─────────────
export async function saveCategoryAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("categories.manage");
  const p = z.object({ name: z.string().trim().min(2, "Nom requis").max(60), description: z.string().trim().max(300), sort_order: z.coerce.number().int().min(0).max(999) }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  let image: string | null = null;
  const f = fd.get("image");
  try { if (f instanceof File && f.size > 0) image = await saveImage(f, 1200); } catch (e) { if (e instanceof UploadError) return { error: e.message }; throw e; }
  const active = bool(fd.get("active"));
  if (id) {
    await query("update categories set name=$2, description=$3, sort_order=$4, active=$5, image_url = coalesce($6, image_url) where id=$1", [id, p.data.name, p.data.description, p.data.sort_order, active, image]);
  } else {
    let slug = slugify(p.data.name);
    if (await one("select 1 from categories where slug = $1", [slug])) slug += "-" + Math.random().toString(36).slice(2, 5);
    await query("insert into categories(slug, name, description, sort_order, active, image_url) values ($1,$2,$3,$4,$5,$6)", [slug, p.data.name, p.data.description, p.data.sort_order, active, image]);
  }
  await audit(u.id, id ? "category.updated" : "category.created", "category", id ?? undefined, { name: p.data.name });
  refresh();
  return { ok: true, message: "Catégorie enregistrée." };
}

export async function deleteCategoryAction(id: string): Promise<ActionState> {
  const u = await requirePerm("categories.manage");
  if (await one("select 1 from products where category_id = $1 limit 1", [id])) return { error: "Cette catégorie contient des produits : déplacez-les ou désactivez la catégorie." };
  await query("delete from categories where id = $1", [id]);
  await audit(u.id, "category.deleted", "category", id);
  refresh();
  return { ok: true, message: "Catégorie supprimée." };
}

// ───────────── Promotions & coupons ─────────────
export async function setPromoAction(id: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  const price = await one<{ price: number }>("select price from products where id = $1", [id]);
  const promo = Number(fd.get("promo_price"));
  if (!price || !Number.isInteger(promo) || promo < 0 || promo >= price.price) return { error: `Le prix promo doit être inférieur à ${price?.price} FCFA.` };
  const end = String(fd.get("promo_ends_at") ?? "");
  await query("update products set promo_price=$2, promo_active=true, promo_ends_at=$3, updated_at=now() where id=$1", [id, promo, end ? new Date(end + "T23:59:59") : null]);
  await audit(u.id, "promo.set", "product", id, { promo });
  refresh();
  return { ok: true, message: "Promotion activée." };
}

export async function stopPromoAction(id: string): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  await query("update products set promo_active = false, updated_at = now() where id = $1", [id]);
  await audit(u.id, "promo.stopped", "product", id);
  refresh();
  return { ok: true, message: "Promotion désactivée." };
}

export async function broadcastPromoAction(id: string): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  const p = await one<any>("select name, slug, price, promo_price from products where id = $1 and promo_active", [id]);
  if (!p) return { error: "Aucune promotion active." };
  const r = await query(
    `insert into notifications(user_id, type, title, body, link)
     select us.id, 'promotion', $1, $2, $3 from users us left join profiles pr on pr.user_id = us.id where us.role_key = 'client' and us.active and coalesce(pr.marketing_opt_in, true) returning id`,
    [`Promo : ${p.name}`, `${p.promo_price} FCFA au lieu de ${p.price} FCFA. Offre limitée !`, `/produits/${p.slug}`]);
  await audit(u.id, "promo.broadcast", "product", id, { recipients: r.length });
  return { ok: true, message: `Notification envoyée à ${r.length} client(s).` };
}

export async function saveCouponAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  const p = z.object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,20}$/, "Code : 3 à 20 lettres/chiffres"), type: z.enum(["percent", "fixed"]),
    value: z.coerce.number().int().positive("Valeur requise"), min_order: z.coerce.number().int().min(0).default(0), max_uses: z.string().optional(), expires_at: z.string().optional(),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  if (d.type === "percent" && d.value > 100) return { error: "Un pourcentage ne peut pas dépasser 100." };
  const args = [d.code, d.type, d.value, d.min_order, d.max_uses ? Number(d.max_uses) : null, d.expires_at ? new Date(d.expires_at + "T23:59:59") : null];
  try {
    if (id) await query("update coupons set code=$2, type=$3, value=$4, min_order=$5, max_uses=$6, expires_at=$7 where id=$1", [id, ...args]);
    else await query("insert into coupons(code, type, value, min_order, max_uses, expires_at) values ($1,$2,$3,$4,$5,$6)", args);
  } catch (e: any) {
    if (e.code === "23505") return { error: "Ce code existe déjà." };
    throw e;
  }
  await audit(u.id, "coupon.saved", "coupon", id ?? undefined, { code: d.code });
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Code promo enregistré." };
}

export async function toggleCouponAction(id: string): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  const r = await one<{ active: boolean }>("update coupons set active = not active where id = $1 returning active", [id]);
  await audit(u.id, "coupon.toggled", "coupon", id, { active: r?.active });
  revalidatePath("/admin/promotions");
  return { ok: true, message: r?.active ? "Code activé." : "Code désactivé." };
}

export async function deleteCouponAction(id: string): Promise<ActionState> {
  const u = await requirePerm("promotions.manage");
  await query("delete from coupons where id = $1", [id]);
  await audit(u.id, "coupon.deleted", "coupon", id);
  revalidatePath("/admin/promotions");
  return { ok: true, message: "Code supprimé." };
}

// ───────────── Avis ─────────────
export async function moderateReviewAction(id: string, action: "hide" | "show" | "delete"): Promise<ActionState> {
  const u = await requirePerm("reviews.moderate");
  if (action === "delete") await query("delete from reviews where id = $1", [id]);
  else await query("update reviews set status = $2 where id = $1", [id, action === "hide" ? "hidden" : "published"]);
  await audit(u.id, `review.${action}`, "review", id);
  refresh();
  return { ok: true, message: "Avis mis à jour." };
}
