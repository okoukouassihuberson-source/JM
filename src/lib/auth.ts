import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { one, query } from "@/db";
import { newToken, sha256 } from "./security";

const COOKIE = "jm_session";
const TTL_DAYS = 30;

export type SessionUser = {
  id: string;
  phone: string;
  first_name: string;
  last_name: string;
  role_key: string;
  role_label: string;
  permissions: string[];
  profile_email: string | null;
};

export const getUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return one<SessionUser>(
    `select u.id, u.phone, u.first_name, u.last_name, u.role_key, r.label as role_label, r.permissions,
            p.email as profile_email
       from sessions s
       join users u on u.id = s.user_id and u.active
       join roles r on r.key = u.role_key
       left join profiles p on p.user_id = u.id
      where s.token_hash = $1 and s.expires_at > now()`,
    [sha256(token)],
  );
});

export const can = (u: Pick<SessionUser, "permissions"> | null | undefined, perm: string) =>
  !!u && (u.permissions.includes("*") || u.permissions.includes(perm));

export const canAny = (u: SessionUser | null, ...perms: string[]) => perms.some((p) => can(u, p));

export const isStaff = (u: SessionUser | null) => !!u && u.role_key !== "client";

export async function createSession(userId: string) {
  const token = newToken();
  const h = await headers();
  await query("insert into sessions(user_id, token_hash, expires_at, user_agent, ip) values ($1,$2, now() + make_interval(days => $3), $4, $5)", [
    userId, sha256(token), TTL_DAYS, h.get("user-agent")?.slice(0, 250) ?? null, h.get("x-forwarded-for")?.split(",")[0].trim() ?? null,
  ]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: TTL_DAYS * 86400,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query("delete from sessions where token_hash = $1", [sha256(token)]);
  jar.delete(COOKIE);
}

/** Révoque toutes les sessions d'un utilisateur (sauf éventuellement la courante). */
export async function revokeSessions(userId: string, exceptToken?: string) {
  await query("delete from sessions where user_id = $1 and ($2::text is null or token_hash <> $2)", [userId, exceptToken ? sha256(exceptToken) : null]);
}
export async function currentTokenHash() {
  const t = (await cookies()).get(COOKIE)?.value;
  return t ? sha256(t) : null;
}

export async function requireUser(next?: string): Promise<SessionUser> {
  const u = await getUser();
  if (!u) redirect(`/connexion${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  return u;
}

/** Pages : redirige si le droit manque. */
export async function requirePage(perm: string | string[], next?: string): Promise<SessionUser> {
  const u = await requireUser(next);
  const perms = Array.isArray(perm) ? perm : [perm];
  if (!perms.some((p) => can(u, p))) redirect(landingFor(u));
  return u;
}

/** Server actions / API : lève une erreur si le droit manque (jamais seulement un bouton caché). */
export async function requirePerm(...perms: string[]): Promise<SessionUser> {
  const u = await getUser();
  if (!u) throw new Error("Veuillez vous connecter.");
  if (!perms.some((p) => can(u, p))) throw new Error("Accès refusé : droits insuffisants.");
  return u;
}

export function landingFor(u: SessionUser): string {
  if (u.role_key === "client") return "/mon-espace";
  if (can(u, "driver.access")) return "/livreur";
  if (can(u, "dashboard.view")) return "/admin";
  if (can(u, "orders.view")) return "/admin/commandes";
  if (can(u, "stock.view")) return "/admin/stock";
  return "/mon-espace";
}

/** Redirection post-connexion : évite les open-redirects (chemins relatifs uniquement). */
export function safeNext(next?: string | null): string | null {
  return next && /^\/(?![/\\])/.test(next) ? next : null;
}
