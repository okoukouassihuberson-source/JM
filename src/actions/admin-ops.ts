"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query, tx } from "@/db";
import { audit } from "@/lib/audit";
import { can, requirePerm } from "@/lib/auth";
import { normalizePhone } from "@/lib/format";
import { adjustStock, StockError } from "@/lib/inventory";
import { notify } from "@/lib/notify";
import { hashPassword, numericCode, sha256 } from "@/lib/security";
import { getSettings, saveSetting, type SettingKey } from "@/lib/settings";
import { saveImage, UploadError } from "@/lib/uploads";
import type { ActionState } from "@/components/ui/ActionForm";

const uuid = z.string().uuid();
const bool = (v: FormDataEntryValue | null) => v === "on" || v === "true";
const rv = (p: string) => revalidatePath(p, "layout");
const firstErr = (e: z.ZodError) => e.issues[0]?.message ?? "Données invalides.";

// ───────────── Stock ─────────────
export async function stockMoveAction(productId: string, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("stock.manage");
  const p = z.object({ type: z.enum(["restock", "loss", "adjustment"]), qty: z.coerce.number().min(0, "Quantité invalide").max(100000), note: z.string().trim().max(200) }).safeParse(Object.fromEntries(fd));
  if (!p.success || !uuid.safeParse(productId).success) return { error: p.success ? "Requête invalide." : firstErr(p.error) };
  const { type, qty, note } = p.data;
  if (type !== "adjustment" && qty <= 0) return { error: "Indiquez une quantité supérieure à 0." };
  try {
    await tx(async (c) => {
      const cur = (await one<{ on_hand: number }>("select on_hand from inventory where product_id = $1", [productId], c))?.on_hand ?? 0;
      const delta = type === "restock" ? qty : type === "loss" ? -qty : Math.round((qty - cur) * 1000) / 1000;
      if (delta === 0) throw new StockError("Aucun changement.");
      await adjustStock(c, productId, type, delta, u.id, note || undefined);
    });
  } catch (e) {
    if (e instanceof StockError) return { error: e.message };
    throw e;
  }
  await audit(u.id, `stock.${type}`, "product", productId, { qty, note });
  rv("/admin"); rv("/");
  return { ok: true, message: "Stock mis à jour." };
}

export async function setThresholdAction(productId: string, thr: number): Promise<ActionState> {
  const u = await requirePerm("stock.manage");
  if (!uuid.safeParse(productId).success || !(thr >= 0) || thr > 100000) return { error: "Seuil invalide." };
  await query("update inventory set alert_threshold = $2, low_alert_sent = false, updated_at = now() where product_id = $1", [productId, thr]);
  await tx((c) => import("@/lib/inventory").then((m) => m.checkLowStock(c, productId)));
  await audit(u.id, "stock.threshold", "product", productId, { thr });
  rv("/admin");
  return { ok: true, message: "Seuil d'alerte enregistré." };
}

// ───────────── Zones ─────────────
export async function saveZoneAction(id: string | null, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("zones.manage");
  const p = z.object({ name: z.string().trim().min(2, "Nom requis").max(80), description: z.string().trim().max(200), fee: z.coerce.number().int().min(0, "Tarif invalide").max(100000), eta_min: z.coerce.number().int().min(5).max(600), eta_max: z.coerce.number().int().min(5).max(600) })
    .refine((d) => d.eta_max >= d.eta_min, { message: "Le délai max doit être ≥ au délai min." }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstErr(p.error) };
  const d = p.data, active = bool(fd.get("active"));
  if (id) await query("update delivery_zones set name=$2, description=$3, fee=$4, eta_min=$5, eta_max=$6, active=$7 where id=$1", [id, d.name, d.description, d.fee, d.eta_min, d.eta_max, active]);
  else await query("insert into delivery_zones(name, description, fee, eta_min, eta_max, active, sort_order) values ($1,$2,$3,$4,$5,$6,(select coalesce(max(sort_order),0)+1 from delivery_zones))", [d.name, d.description, d.fee, d.eta_min, d.eta_max, active]);
  await audit(u.id, "zone.saved", "zone", id ?? undefined, d);
  rv("/admin"); rv("/livraison");
  return { ok: true, message: "Zone enregistrée." };
}

export async function toggleZoneAction(id: string): Promise<ActionState> {
  const u = await requirePerm("zones.manage");
  const r = await one<{ active: boolean }>("update delivery_zones set active = not active where id = $1 returning active", [id]);
  await audit(u.id, "zone.toggled", "zone", id, r);
  rv("/admin"); rv("/livraison");
  return { ok: true, message: r?.active ? "Zone activée." : "Zone désactivée." };
}

export async function deleteZoneAction(id: string): Promise<ActionState> {
  const u = await requirePerm("zones.manage");
  if (await one("select 1 from orders where zone_id = $1 limit 1", [id])) return { error: "Des commandes utilisent cette zone : désactivez-la plutôt." };
  await query("delete from delivery_zones where id = $1", [id]);
  await audit(u.id, "zone.deleted", "zone", id);
  rv("/admin"); rv("/livraison");
  return { ok: true, message: "Zone supprimée." };
}

// ───────────── Comptes : livreurs, équipe, clients ─────────────
const STAFF_ROLES = ["manager", "stock_manager", "preparer", "driver"] as const;

export async function createStaffAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("staff.manage", "drivers.manage");
  const p = z.object({
    first_name: z.string().trim().min(2).max(60), last_name: z.string().trim().min(2).max(60),
    phone: z.string().transform((v) => normalizePhone(v)).refine((v): v is string => !!v, "Téléphone invalide"),
    password: z.string().min(8, "8 caractères minimum").max(128), role: z.enum(STAFF_ROLES), vehicle: z.string().trim().max(30).default("Moto"),
  }).safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstErr(p.error) };
  const d = p.data;
  if (d.role === "driver" ? !can(u, "drivers.manage") : !can(u, "staff.manage")) return { error: "Accès refusé : droits insuffisants." };
  if (d.role === "manager" && !can(u, "*")) return { error: "Seul le super admin peut créer un gérant." };
  if (await one("select 1 from users where phone = $1", [d.phone])) return { error: "Ce numéro est déjà utilisé." };
  await tx(async (c) => {
    const nu = (await one<{ id: string }>("insert into users(phone, password_hash, role_key, first_name, last_name) values ($1,$2,$3,$4,$5) returning id", [d.phone, await hashPassword(d.password), d.role, d.first_name, d.last_name], c))!;
    await query("insert into profiles(user_id) values ($1)", [nu.id], c);
    if (d.role === "driver") await query("insert into drivers(user_id, vehicle) values ($1,$2)", [nu.id, d.vehicle], c);
  });
  await audit(u.id, "staff.created", "user", d.phone, { role: d.role });
  rv("/admin");
  return { ok: true, message: "Compte créé." };
}

export async function toggleUserAction(userId: string): Promise<ActionState> {
  const u = await requirePerm("staff.manage", "customers.manage", "drivers.manage");
  if (userId === u.id) return { error: "Vous ne pouvez pas désactiver votre propre compte." };
  const t = await one<{ role_key: string }>("select role_key from users where id = $1", [userId]);
  if (!t) return { error: "Utilisateur introuvable." };
  if (t.role_key === "super_admin" && !can(u, "*")) return { error: "Accès refusé." };
  if (t.role_key === "client" ? !can(u, "customers.manage") : t.role_key === "driver" ? !(can(u, "drivers.manage") || can(u, "staff.manage")) : !can(u, "staff.manage")) return { error: "Accès refusé : droits insuffisants." };
  const r = await one<{ active: boolean }>("update users set active = not active where id = $1 returning active", [userId]);
  if (!r?.active) await query("delete from sessions where user_id = $1", [userId]);
  await audit(u.id, "user.toggled", "user", userId, r);
  rv("/admin");
  return { ok: true, message: r?.active ? "Compte réactivé." : "Compte désactivé (déconnecté partout)." };
}

export async function setRoleAction(userId: string, role: string): Promise<ActionState> {
  const u = await requirePerm("staff.manage");
  if (!z.enum(["client", ...STAFF_ROLES]).safeParse(role).success) return { error: "Rôle invalide." };
  if (userId === u.id) return { error: "Vous ne pouvez pas changer votre propre rôle." };
  const t = await one<{ role_key: string }>("select role_key from users where id = $1", [userId]);
  if (!t || (t.role_key === "super_admin" && !can(u, "*"))) return { error: "Accès refusé." };
  if (role === "manager" && !can(u, "*")) return { error: "Seul le super admin peut nommer un gérant." };
  await tx(async (c) => {
    await query("update users set role_key = $2 where id = $1", [userId, role], c);
    if (role === "driver") await query("insert into drivers(user_id) values ($1) on conflict do nothing", [userId], c);
    await query("delete from sessions where user_id = $1", [userId], c);
  });
  await audit(u.id, "user.role_changed", "user", userId, { from: t.role_key, to: role });
  rv("/admin");
  return { ok: true, message: "Rôle mis à jour." };
}

/** Génère le code à usage unique (valable 1 h) à communiquer au client par téléphone/WhatsApp. */
export async function issueResetCodeAction(userId: string): Promise<ActionState> {
  const u = await requirePerm("customers.manage", "staff.manage");
  const t = await one<{ role_key: string }>("select role_key from users where id = $1", [userId]);
  if (!t || (t.role_key !== "client" && !can(u, "staff.manage")) || (t.role_key === "super_admin" && !can(u, "*"))) return { error: "Accès refusé." };
  const code = numericCode(6);
  await query("update password_resets set used_at = now() where user_id = $1 and used_at is null", [userId]);
  await query("insert into password_resets(user_id, code_hash, issued_by, expires_at) values ($1,$2,$3, now() + interval '1 hour')", [userId, sha256(code), u.id]);
  await audit(u.id, "user.reset_code_issued", "user", userId);
  rv("/admin");
  return { ok: true, message: `Code de réinitialisation : ${code} (valable 1 h, à communiquer au client)` };
}

export async function setDriverStatusAction(driverId: string, status: "available" | "unavailable"): Promise<ActionState> {
  const u = await requirePerm("drivers.manage");
  if (!["available", "unavailable"].includes(status)) return { error: "Statut invalide." };
  const busy = await one("select 1 from deliveries where driver_id = $1 and status in ('en_route','arrived')", [driverId]);
  if (busy) return { error: "Ce livreur est en pleine livraison." };
  await query("update drivers set status = $2 where id = $1", [driverId, status]);
  await audit(u.id, "driver.status", "driver", driverId, { status });
  rv("/admin");
  return { ok: true, message: "Statut mis à jour." };
}

export async function notifyUserAction(userId: string, title: string): Promise<ActionState> {
  await requirePerm("customers.manage");
  await notify(userId, { type: "info", title: title.slice(0, 100) });
  return { ok: true, message: "Notification envoyée." };
}

// ───────────── Paramètres ─────────────
const str = (n: number) => z.string().trim().max(n);
const SCHEMAS: Record<string, z.ZodType<any>> = {
  brand: z.object({ name: str(60).min(2), slogan: str(120), tagline: str(120), hero_title: str(120), hero_subtitle: str(250) }),
  contact: z.object({
    phone: str(30).min(6, "Téléphone requis"), whatsapp: z.string().transform((v, ctx) => { const p = normalizePhone(v); if (!p) ctx.addIssue({ code: "custom", message: "Numéro WhatsApp invalide" }); return p ?? ""; }),
    whatsapp_message: str(200), email: z.string().trim().email("E-mail invalide").or(z.literal("")), address: str(200).min(3, "Adresse requise"), city: str(80), country: str(60),
    latitude: z.string().trim().regex(/^(-?\d+(\.\d+)?)?$/, "Latitude invalide"), longitude: z.string().trim().regex(/^(-?\d+(\.\d+)?)?$/, "Longitude invalide"),
  }),
  social: z.object({ facebook: z.string().trim().url().or(z.literal("")), instagram: z.string().trim().url().or(z.literal("")), tiktok: z.string().trim().url().or(z.literal("")) }),
  delivery: z.object({ express_supplement: z.coerce.number().int().min(0).max(100000), free_delivery_threshold: z.coerce.number().int().min(0).max(10_000_000), min_order: z.coerce.number().int().min(0).max(10_000_000) }),
  payment: z.object({ mobile_money_numbers: str(400) }),
  seo: z.object({ title: str(120).min(5), description: str(300).min(20), keywords: str(300) }),
};
const BOOLS: Record<string, string[]> = {
  delivery: ["pickup_enabled", "express_enabled", "require_delivery_code", "live_tracking_enabled"],
  payment: ["cash_on_delivery", "mobile_money_manual", "cinetpay"],
};

export async function saveSettingsAction(group: SettingKey, _: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requirePerm("settings.manage");
  if (group === "hours") {
    const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
    const hours = days.map((day, i) => ({ day, open: String(fd.get(`open${i}`) ?? "07:00"), close: String(fd.get(`close${i}`) ?? "20:00"), closed: bool(fd.get(`closed${i}`)) }));
    if (hours.some((h) => !/^\d{2}:\d{2}$/.test(h.open) || !/^\d{2}:\d{2}$/.test(h.close))) return { error: "Horaires invalides." };
    await saveSetting("hours", hours, u.id);
  } else {
    const schema = SCHEMAS[group];
    if (!schema) return { error: "Groupe inconnu." };
    const p = schema.safeParse(Object.fromEntries(fd));
    if (!p.success) return { error: firstErr(p.error) };
    const current: any = (await getSettings())[group];
    const value: any = { ...current, ...p.data };
    for (const b of BOOLS[group] ?? []) value[b] = bool(fd.get(b));
    if (group === "brand") {
      const f = fd.get("logo");
      try { if (f instanceof File && f.size > 0) value.logo_url = await saveImage(f, 800); } catch (e) { if (e instanceof UploadError) return { error: e.message }; throw e; }
    }
    await saveSetting(group, value, u.id);
  }
  await audit(u.id, "settings.updated", "settings", group);
  revalidatePath("/", "layout");
  return { ok: true, message: "Paramètres enregistrés." };
}
