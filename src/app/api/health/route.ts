import { NextResponse } from "next/server";
import { pool } from "@/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostic de déploiement : GET /api/health
 * Indique si DATABASE_URL est définie, si la base répond et si le schéma est installé.
 * Ne renvoie jamais de secret (ni URL, ni mot de passe).
 */
/** Diagnostic Supabase Storage (photos) : n'expose jamais la clé, seulement son type et si elle est acceptée. */
async function storageStatus(): Promise<Record<string, unknown>> {
  const url = (process.env.SUPABASE_URL || "").trim().replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const out: Record<string, unknown> = { url_defined: !!url, key_defined: !!key, bucket: process.env.SUPABASE_BUCKET || "jm-media", on_vercel: !!process.env.VERCEL };
  if (url) { try { out.url_host = new URL(url).host; } catch { out.url_valid = false; } }
  if (key) {
    out.key_has_whitespace = key !== key.trim();
    if (key.startsWith("sb_secret_")) out.key_type = "secret";
    else if (key.startsWith("sb_publishable_")) out.key_type = "publishable (mauvaise clé)";
    else {
      try { out.key_type = JSON.parse(Buffer.from(key.split(".")[1] ?? "", "base64url").toString()).role ?? "inconnu"; } catch { out.key_type = "illisible"; }
    }
  }
  if (!url || !key) out.hint = `Variable(s) manquante(s) dans ce déploiement : ${[!url && "SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean).join(", ")}. Vérifiez le nom exact, l'environnement Production, puis faites un Redeploy.`;
  else {
    try {
      const r = await fetch(`${url}/storage/v1/bucket`, { headers: { Authorization: `Bearer ${key.trim()}`, apikey: key.trim() }, signal: AbortSignal.timeout(5000) });
      out.storage_http_status = r.status;
      out.hint = r.ok ? "Stockage des photos opérationnel." : out.key_type === "anon" || /publishable/.test(String(out.key_type)) ? "Vous avez mis la clé « anon / publishable » : il faut la clé service_role (ou sb_secret_…)." : "Clé refusée ou URL incorrecte (Settings → API dans Supabase).";
    } catch (e: any) {
      out.storage_error = String(e?.message ?? e).slice(0, 120);
      out.hint = "Supabase injoignable : vérifiez SUPABASE_URL.";
    }
  }
  return out;
}

export async function GET() {
  const out: Record<string, unknown> = {
    database_url_defined: !!process.env.DATABASE_URL,
    database_ssl: process.env.DATABASE_SSL === "true",
    site_url: process.env.NEXT_PUBLIC_SITE_URL ?? null,
    photos_storage: await storageStatus(),
  };
  const u = process.env.DATABASE_URL;
  if (u) {
    try {
      const m = new URL(u);
      out.database_host = m.hostname;
      out.database_port = m.port || "5432";
      if (/supabase\.com$/.test(m.hostname)) out.database_user_ok = /^postgres\.[a-z0-9]+$/.test(decodeURIComponent(m.username));
    } catch {
      out.database_url_valid = false;
      out.hint = "DATABASE_URL illisible : le mot de passe contient sans doute un caractère spécial non encodé (@ → %40, # → %23, / → %2F, : → %3A).";
    }
  }
  if (!u) {
    out.hint = "Variable DATABASE_URL absente : ajoutez-la dans Vercel (Settings → Environment Variables) puis faites un Redeploy.";
    return NextResponse.json(out, { status: 500 });
  }
  try {
    const r = await pool().query(
      `select current_database() as db,
              (select count(*) from information_schema.tables where table_schema = 'public') as tables,
              to_regclass('public.products') is not null as has_products,
              to_regclass('public.settings') is not null as has_settings`,
    );
    Object.assign(out, { connected: true, ...r.rows[0] });
    if (!r.rows[0].has_products) out.hint = "Connexion OK mais le schéma n'est pas installé : exécutez les fichiers db/supabase/01 → 13 dans le SQL Editor de Supabase.";
    else {
      const n = await pool().query("select (select count(*) from products) as products, (select count(*) from categories) as categories");
      Object.assign(out, n.rows[0]);
      out.hint = "Tout est en place.";
    }
    return NextResponse.json(out);
  } catch (e: any) {
    out.connected = false;
    out.error_code = e.code ?? null;
    out.error_message = String(e.message ?? e).replace(/postgres(ql)?:\/\/[^\s]+/gi, "[url]").slice(0, 300);
    out.hint =
      e.code === "28P01" || /password authentication/i.test(e.message) ? "Mot de passe de la base incorrect (pensez à encoder les caractères spéciaux)."
      : /Tenant or user not found/i.test(e.message) ? "Nom d'utilisateur ou région du pooler incorrects (format : postgres.<ref-projet>)."
      : /ENOTFOUND|ECONNREFUSED|ETIMEDOUT/.test(e.code ?? e.message) ? "Hôte injoignable : vérifiez l'adresse du pooler et le port (6543 sur Vercel)."
      : /SSL|certificate/i.test(e.message) ? "Problème SSL : mettez DATABASE_SSL=true."
      : "Voir error_message.";
    return NextResponse.json(out, { status: 500 });
  }
}
