import type { Metadata } from "next";
import { createStaffAction } from "@/actions/admin-ops";
import { DriverRow } from "@/components/admin/DriverRow";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";

export const metadata: Metadata = { title: "Livreurs" };

export default async function Livreurs() {
  await requirePage("drivers.manage", "/admin/livreurs");
  const rows = await query<any>(
    `select dr.id, dr.status, dr.vehicle, u.id as user_id, u.first_name, u.last_name, u.phone, u.active,
        count(d.id) filter (where d.assigned_at::date = current_date and d.status <> 'pending') as today,
        count(d.id) filter (where d.status = 'delivered') as done, count(d.id) filter (where d.status = 'failed') as failed,
        count(d.id) filter (where d.status in ('assigned','accepted','en_route','arrived')) as active_jobs
       from drivers dr join users u on u.id = dr.user_id left join deliveries d on d.driver_id = dr.id group by dr.id, u.id order by u.first_name`);
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Livreurs</h1>
      <div className="card overflow-x-auto"><table className="w-full min-w-[820px]"><thead className="border-b border-line bg-electric-50/60"><tr>{["Livreur", "Téléphone", "Statut", "Livraisons du jour", "Terminées", "Échouées", ""].map((h) => <th key={h} className="th">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-line">{rows.map((r) => <DriverRow key={r.id} r={r} />)}</tbody></table></div>
      <details className="card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Ajouter un livreur</summary>
        <ActionForm action={createStaffAction} className="mt-4 grid gap-3 sm:grid-cols-2" reset>
          <input type="hidden" name="role" value="driver" />
          <div><label className="label">Prénom</label><input name="first_name" required className="input" /></div><div><label className="label">Nom</label><input name="last_name" required className="input" /></div>
          <div><label className="label">Téléphone (identifiant)</label><input name="phone" required inputMode="tel" className="input" /></div><div><label className="label">Véhicule</label><input name="vehicle" defaultValue="Moto" className="input" /></div>
          <div className="sm:col-span-2"><label className="label">Mot de passe initial</label><PasswordInput name="password" minLength={8} required autoComplete="new-password" /></div>
          <div className="sm:col-span-2"><Submit className="btn-primary">Créer le livreur</Submit></div></ActionForm></details>
    </div>
  );
}
