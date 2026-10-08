import { after } from "next/server";
import { query, type Tx } from "@/db";
import { sendPush } from "./push";

type N = { type: string; title: string; body?: string; link?: string };

/** Envoi push après la réponse (ne ralentit pas la requête) ; hors requête (scripts) : envoi direct. */
function push(userIds: string[], n: N) {
  const run = async () => { for (const id of userIds) await sendPush(id, { title: n.title, body: n.body, link: n.link, tag: n.type }).catch(() => {}); };
  try { after(run); } catch { void run(); }
}

export async function notify(userId: string, n: N, c?: Tx) {
  await query("insert into notifications(user_id, type, title, body, link) values ($1,$2,$3,$4,$5)", [userId, n.type, n.title, n.body ?? "", n.link ?? null], c);
  push([userId], n);
}

/** Notifie tous les comptes actifs ayant l'un des rôles donnés (ex: gérant + préparateurs). */
export async function notifyRoles(roles: string[], n: N, c?: Tx) {
  const rows = await query<{ user_id: string }>(
    `insert into notifications(user_id, type, title, body, link)
     select id, $2, $3, $4, $5 from users where active and role_key = any($1::text[]) returning user_id`,
    [roles, n.type, n.title, n.body ?? "", n.link ?? null],
    c,
  );
  push(rows.map((r) => r.user_id), n);
}
