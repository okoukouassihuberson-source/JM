"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { one, query } from "@/db";
import { audit } from "@/lib/audit";
import { createSession, currentTokenHash, destroySession, getUser, landingFor, requireUser, revokeSessions, safeNext } from "@/lib/auth";
import { mergeGuestCart } from "@/lib/cart";
import { normalizePhone } from "@/lib/format";
import { notifyRoles } from "@/lib/notify";
import { dummyVerify, hashPassword, numericCode, rateLimit, resetRateLimit, sha256, verifyPassword } from "@/lib/security";
import type { ActionState } from "@/components/ui/ActionForm";

const ip = async () => (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
const name = z.string().trim().min(2, "Au moins 2 caractères").max(60);
const password = z.string().min(8, "Le mot de passe doit contenir au moins 8 caractères").max(128);
const phoneSchema = z.string().transform((v, ctx) => {
  const p = normalizePhone(v);
  if (!p) ctx.addIssue({ code: "custom", message: "Numéro de téléphone invalide" });
  return p as string;
});
const firstError = (e: z.ZodError) => e.issues[0]?.message ?? "Données invalides.";

export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ last_name: name, first_name: name, phone: phoneSchema, password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await rateLimit(`register:${await ip()}`, 8, 3600))) return { error: "Trop de tentatives. Réessayez plus tard." };
  if (await one("select 1 from users where phone = $1", [d.phone])) return { error: "Un compte existe déjà avec ce numéro. Connectez-vous." };
  const u = await one<{ id: string }>(
    "insert into users(phone, password_hash, first_name, last_name) values ($1,$2,$3,$4) returning id", [d.phone, await hashPassword(d.password), d.first_name, d.last_name]);
  await query("insert into profiles(user_id) values ($1)", [u!.id]);
  await createSession(u!.id);
  await mergeGuestCart(u!.id);
  await audit(u!.id, "auth.register", "user", u!.id);
  redirect(safeNext(String(fd.get("next") ?? "")) ?? "/mon-espace");
}

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ phone: phoneSchema, password: z.string().min(1).max(128) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { phone, password: pwd } = parsed.data;
  const keyPhone = `login:phone:${phone}`, keyIp = `login:ip:${await ip()}`;
  if (!(await rateLimit(keyPhone, 6, 900)) || !(await rateLimit(keyIp, 40, 900))) return { error: "Trop de tentatives. Réessayez dans quelques minutes." };
  const u = await one<{ id: string; password_hash: string; active: boolean; role_key: string }>("select id, password_hash, active, role_key from users where phone = $1", [phone]);
  if (!u) { await dummyVerify(pwd); return { error: "Numéro ou mot de passe incorrect." }; }
  if (!(await verifyPassword(pwd, u.password_hash))) { await audit(u.id, "auth.login_failed", "user", u.id); return { error: "Numéro ou mot de passe incorrect." }; }
  if (!u.active) return { error: "Ce compte est désactivé. Contactez JM Poissonnerie." };
  await resetRateLimit(keyPhone);
  await createSession(u.id);
  await query("update users set last_login_at = now() where id = $1", [u.id]);
  await mergeGuestCart(u.id);
  if (u.role_key !== "client") await audit(u.id, "auth.login_staff", "user", u.id);
  const me = (await getUser())!;
  redirect(safeNext(String(fd.get("next") ?? "")) ?? landingFor(me));
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

/** « Mot de passe oublié » sans SMS/OTP : la demande est transmise au gérant qui remet un code à usage unique (WhatsApp/téléphone). */
export async function forgotPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ phone: phoneSchema }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await rateLimit(`forgot:${await ip()}`, 5, 3600))) return { error: "Trop de demandes. Réessayez plus tard." };
  const u = await one<{ id: string; first_name: string; last_name: string }>("select id, first_name, last_name from users where phone = $1 and active", [parsed.data.phone]);
  if (u && !(await one("select 1 from password_resets where user_id = $1 and used_at is null and code_hash is null and requested_at > now() - interval '1 day'", [u.id]))) {
    await query("insert into password_resets(user_id) values ($1)", [u.id]);
    await notifyRoles(["super_admin", "manager"], { type: "password_reset", title: "Demande de réinitialisation de mot de passe", body: `${u.first_name} ${u.last_name} (${parsed.data.phone})`, link: "/admin/clients" });
  }
  // Réponse identique que le compte existe ou non (pas d'énumération de comptes).
  return { ok: true, message: "Demande enregistrée. JM Poissonnerie vous contactera pour vous remettre un code de réinitialisation." };
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z.object({ phone: phoneSchema, code: z.string().trim().regex(/^\d{6}$/, "Code à 6 chiffres requis"), password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;
  if (!(await rateLimit(`reset:${d.phone}`, 5, 900)) || !(await rateLimit(`reset:ip:${await ip()}`, 20, 900))) return { error: "Trop de tentatives. Réessayez plus tard." };
  const r = await one<{ id: string; user_id: string }>(
    `select r.id, r.user_id from password_resets r join users u on u.id = r.user_id
      where u.phone = $1 and r.code_hash = $2 and r.used_at is null and r.expires_at > now() order by r.requested_at desc limit 1`, [d.phone, sha256(d.code)]);
  if (!r) return { error: "Code invalide ou expiré. Demandez un nouveau code." };
  await query("update users set password_hash = $2 where id = $1", [r.user_id, await hashPassword(d.password)]);
  await query("update password_resets set used_at = now() where id = $1", [r.id]);
  await revokeSessions(r.user_id);
  await audit(r.user_id, "auth.password_reset", "user", r.user_id);
  redirect("/connexion?reset=1");
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = z.object({ current: z.string().min(1, "Mot de passe actuel requis"), password, confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Les mots de passe ne correspondent pas", path: ["confirm"] })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  if (!(await rateLimit(`chpw:${u.id}`, 6, 900))) return { error: "Trop de tentatives." };
  const row = await one<{ password_hash: string }>("select password_hash from users where id = $1", [u.id]);
  if (!row || !(await verifyPassword(parsed.data.current, row.password_hash))) return { error: "Mot de passe actuel incorrect." };
  await query("update users set password_hash = $2 where id = $1", [u.id, await hashPassword(parsed.data.password)]);
  const cur = await currentTokenHash();
  await query("delete from sessions where user_id = $1 and token_hash <> $2", [u.id, cur]); // déconnecte les autres appareils
  await audit(u.id, "auth.password_changed", "user", u.id);
  return { ok: true, message: "Mot de passe mis à jour." };
}

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const u = await requireUser();
  const parsed = z.object({ first_name: name, last_name: name, email: z.string().trim().email("E-mail invalide").or(z.literal("")) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  await query("update users set first_name = $2, last_name = $3 where id = $1", [u.id, parsed.data.first_name, parsed.data.last_name]);
  await query("insert into profiles(user_id, email) values ($1,$2) on conflict (user_id) do update set email = excluded.email, updated_at = now()", [u.id, parsed.data.email || null]);
  return { ok: true, message: "Profil mis à jour." };
}
