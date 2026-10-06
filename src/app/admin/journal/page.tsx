import type { Metadata } from "next";
import { Pagination } from "@/components/ui/bits";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Journal d'audit" };
const SIZE = 30;

export default async function Journal({ searchParams }: { searchParams: Promise<{ page?: string; q?: string }> }) {
  await requirePage("audit.view", "/admin/journal");
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const params: any[] = [];
  let where = "";
  if (sp.q?.trim()) { params.push(`%${sp.q.trim().replace(/[\\%_]/g, "\\$&")}%`); where = "where a.action ilike $1 or u.first_name ilike $1 or u.last_name ilike $1"; }
  const [rows, [{ n }]] = await Promise.all([
    query<any>(`select a.*, u.first_name, u.last_name, u.role_key from audit_logs a left join users u on u.id = a.user_id ${where} order by a.created_at desc, a.id desc limit ${SIZE} offset ${(page - 1) * SIZE}`, params),
    query<any>(`select count(*) n from audit_logs a left join users u on u.id = a.user_id ${where}`, params),
  ]);
  return (
    <div className="space-y-5">
      <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Opérations sensibles — {n} entrées</p><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Journal d&apos;audit</h1></div>
      <form className="card flex gap-3 p-4"><input name="q" defaultValue={sp.q} placeholder="Action ou utilisateur (ex : price, login_failed…)" className="input" /><button className="btn-navy">Filtrer</button></form>
      <div className="card overflow-x-auto"><table className="w-full min-w-[800px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Date", "Utilisateur", "Action", "Cible", "Détails", "IP"].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line text-xs">{rows.map((a) => <tr key={a.id}><td className="td whitespace-nowrap text-muted">{fmtDateTime(a.created_at)}</td><td className="td font-bold">{a.first_name ? `${a.first_name} ${a.last_name}` : "—"}</td><td className="td"><code className="rounded bg-electric-50 px-1.5 py-0.5 font-bold text-navy-800">{a.action}</code></td><td className="td text-muted">{a.entity}{a.entity_id ? ` · ${String(a.entity_id).slice(0, 8)}` : ""}</td><td className="td max-w-72 truncate text-muted" title={a.details ? JSON.stringify(a.details) : ""}>{a.details ? JSON.stringify(a.details) : ""}</td><td className="td text-muted">{a.ip}</td></tr>)}</tbody></table></div>
      <Pagination page={page} pages={Math.ceil(n / SIZE)} href={(p) => `/admin/journal?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
    </div>
  );
}
