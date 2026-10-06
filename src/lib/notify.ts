import { query, type Tx } from "@/db";

type N = { type: string; title: string; body?: string; link?: string };

export async function notify(userId: string, n: N, c?: Tx) {
  await query("insert into notifications(user_id, type, title, body, link) values ($1,$2,$3,$4,$5)", [userId, n.type, n.title, n.body ?? "", n.link ?? null], c);
}

/** Notifie tous les comptes actifs ayant l'un des rôles donnés (ex: gérant + préparateurs). */
export async function notifyRoles(roles: string[], n: N, c?: Tx) {
  await query(
    `insert into notifications(user_id, type, title, body, link)
     select id, $2, $3, $4, $5 from users where active and role_key = any($1::text[])`,
    [roles, n.type, n.title, n.body ?? "", n.link ?? null],
    c,
  );
}
