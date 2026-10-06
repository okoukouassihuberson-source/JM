import type { Metadata } from "next";
import { createStaffAction } from "@/actions/admin-ops";
import { UserRow } from "@/components/admin/UserRow";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Pagination } from "@/components/ui/bits";
import { query } from "@/db";
import { can, requirePage } from "@/lib/auth";
import { fcfa, fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Clients & équipe" };
const SIZE = 20;

export default async function Clients({ searchParams }: { searchParams: Promise<{ q?: string; vue?: string; page?: string }> }) {
  const u = await requirePage(["customers.view", "staff.manage"], "/admin/clients");
  const sp = await searchParams;
  const staffView = sp.vue === "equipe" && can(u, "staff.manage");
  const page = Math.max(1, parseInt(sp.page ?? "1") || 1);
  const params: any[] = [];
  let where = staffView ? "where us.role_key <> 'client'" : "where us.role_key = 'client'";
  if (sp.q?.trim()) { params.push(`%${sp.q.trim().replace(/[\\%_]/g, "\\$&")}%`); where += ` and (us.first_name || ' ' || us.last_name ilike $1 or us.phone like $1)`; }
  const [rows, [{ n }], resets, roles] = await Promise.all([
    query<any>(`select us.id, us.phone, us.first_name, us.last_name, us.role_key, r.label as role_label, us.active, us.created_at, us.last_login_at,
        (select count(*) from orders o where o.user_id = us.id) as orders, (select coalesce(sum(total),0) from orders o where o.user_id = us.id and o.status = 'delivered') as spent
        from users us join roles r on r.key = us.role_key ${where} order by us.created_at desc limit ${SIZE} offset ${(page - 1) * SIZE}`, params),
    query<any>(`select count(*) n from users us ${where}`, params),
    query<any>(`select pr.id, pr.requested_at, us.id as user_id, us.first_name, us.last_name, us.phone from password_resets pr join users us on us.id = pr.user_id where pr.used_at is null and pr.code_hash is null order by pr.requested_at desc limit 10`),
    query<any>("select key, label from roles where key <> 'super_admin' order by label"),
  ]);
  const tab = (href: string, label: string, on: boolean) => <a href={href} className={`btn btn-sm !rounded-full border-2 ${on ? "border-navy-900 bg-navy-900 text-white" : "border-line bg-white"}`}>{label}</a>;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><h1 className="h-display text-4xl text-navy-900 sm:text-5xl">{staffView ? "Équipe" : "Clients"}</h1>
        <div className="flex gap-2">{tab("/admin/clients", "Clients", !staffView)}{can(u, "staff.manage") && tab("/admin/clients?vue=equipe", "Équipe", staffView)}</div></div>
      {resets.length > 0 && can(u, "customers.manage") && (
        <section className="card border-warning-600/30 bg-warning-50/60 p-4"><h2 className="mb-2 flex items-center gap-2 font-extrabold text-warning-600"><Icon name="lock" size={18} /> Demandes de réinitialisation de mot de passe</h2>
          <ul className="space-y-1 text-sm">{resets.map((r) => <li key={r.id}><b>{r.first_name} {r.last_name}</b> — {r.phone} <span className="text-muted">({fmtDateTime(r.requested_at)})</span> → utilisez « Code de réinitialisation » dans la liste ci-dessous.</li>)}</ul></section>)}
      <form className="card flex gap-3 p-4"><input type="hidden" name="vue" value={sp.vue ?? ""} /><input name="q" defaultValue={sp.q} placeholder="Nom ou téléphone…" className="input" /><button className="btn-navy">Rechercher</button></form>
      <div className="card overflow-x-auto"><table className="w-full min-w-[860px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Nom", "Téléphone", staffView ? "Rôle" : "Commandes", staffView ? "Dernière connexion" : "Dépensé", "Statut", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <UserRow key={r.id} r={r} staff={staffView} roles={roles} canRole={can(u, "staff.manage") && r.id !== u.id && (r.role_key !== "super_admin" || can(u, "*"))} canReset={can(u, "customers.manage") || can(u, "staff.manage")} canToggle={r.id !== u.id && (r.role_key === "client" ? can(u, "customers.manage") : can(u, "staff.manage"))} />)}
          {rows.length === 0 && <tr><td colSpan={6} className="td py-10 text-center text-muted">Aucun résultat.</td></tr>}</tbody></table></div>
      <Pagination page={page} pages={Math.ceil(n / SIZE)} href={(p) => `/admin/clients?${new URLSearchParams({ ...(sp.vue ? { vue: sp.vue } : {}), ...(sp.q ? { q: sp.q } : {}), page: String(p) })}`} />
      {staffView && (
        <details className="card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Ajouter un membre d&apos;équipe</summary>
          <ActionForm action={createStaffAction} className="mt-4 grid gap-3 sm:grid-cols-2" reset>
            <div><label className="label">Prénom</label><input name="first_name" required className="input" /></div><div><label className="label">Nom</label><input name="last_name" required className="input" /></div>
            <div><label className="label">Téléphone</label><input name="phone" required className="input" /></div>
            <div><label className="label">Rôle</label><select name="role" className="input"><option value="stock_manager">Gestionnaire stock</option><option value="preparer">Préparateur</option><option value="driver">Livreur</option>{can(u, "*") && <option value="manager">Gérant</option>}</select></div>
            <div className="sm:col-span-2"><label className="label">Mot de passe initial</label><PasswordInput name="password" minLength={8} required autoComplete="new-password" /></div>
            <div className="sm:col-span-2"><Submit className="btn-primary">Créer le compte</Submit></div></ActionForm></details>)}
    </div>
  );
}
