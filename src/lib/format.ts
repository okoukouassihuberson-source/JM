// Utilitaires de formatage — purs, utilisables côté serveur ET client.

const TZ = "Africa/Abidjan";

/** 1400 → "1 400 FCFA" (espaces classiques : compatibles PDF et copier/coller). */
export function fcfa(n: number, withUnit = true): string {
  const s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return withUnit ? `${s} FCFA` : s;
}

export function num(n: number, maxDigits = 2): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDigits }).format(n).replace(/[  ]/g, " ");
}

export type UnitInfo = { unit: string; unit_label: string };

/** Libellé court affiché après le prix : "KG", "PIÈCE"… */
export function unitShort(u: UnitInfo): string {
  return (u.unit === "kg" ? "kg" : u.unit_label).toUpperCase();
}

/** 0.5 kg → "500 g" ; 1.5 → "1,5 kg" ; 3 pièces → "3 pièces". */
export function formatQty(q: number, u: UnitInfo): string {
  if (u.unit === "kg") return q < 1 ? `${Math.round(q * 1000)} g` : `${num(q, 3)} kg`;
  const label = q > 1 && !/[sx]$/.test(u.unit_label) && u.unit !== "custom" ? `${u.unit_label}s` : u.unit_label;
  return `${num(q, 3)} ${label}`;
}

const dtf = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...o });
export const fmtDate = (d: Date | string) => dtf({ day: "2-digit", month: "short", year: "numeric" }).format(new Date(d)).replace(".", "");
export const fmtTime = (d: Date | string) => dtf({ hour: "2-digit", minute: "2-digit" }).format(new Date(d));
export const fmtDateTime = (d: Date | string) => `${fmtDate(d)} à ${fmtTime(d)}`;
export const fmtDay = (d: Date | string) => dtf({ weekday: "short", day: "2-digit", month: "short" }).format(new Date(d));

export function timeAgo(d: Date | string): string {
  const s = Math.max(1, Math.round((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `il y a ${Math.floor(s / 86400)} j`;
  return fmtDate(d);
}

// ───────────── Téléphone ─────────────
const CC = process.env.DEFAULT_COUNTRY_CODE || "225";

/** Normalise un numéro saisi ("07 10 36 99 75", "+225 0710369975"…) en chiffres seuls avec indicatif. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  else if (d.startsWith("00")) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 10) d = CC + d; // numéro local à 10 chiffres
  else if (d.length === 8 || d.length === 10) d = CC + d;
  if (!/^\d{9,15}$/.test(d)) return null;
  return d;
}

/** 2250710369975 → "07 10 36 99 75" (format local ivoirien) sinon "+indicatif…". */
export function displayPhone(p: string): string {
  if (p.startsWith("225") && p.length === 13) return p.slice(3).replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return "+" + p;
}

export function slugify(s: string): string {
  return s
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "produit";
}
