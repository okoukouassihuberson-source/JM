import { query } from "@/db";

/** Journalise une opération sensible (ne fait jamais échouer l'action appelante). */
export async function audit(userId: string | null, action: string, entity?: string, entityId?: string, details?: unknown) {
  let ip: string | null = null;
  try {
    const { headers } = await import("next/headers");
    ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  } catch {
    /* hors requête (scripts) */
  }
  try {
    await query("insert into audit_logs(user_id, action, entity, entity_id, details, ip) values ($1,$2,$3,$4,$5,$6)", [
      userId, action, entity ?? null, entityId ?? null, details ? JSON.stringify(details) : null, ip,
    ]);
  } catch (e) {
    console.error("audit failed", e);
  }
}
