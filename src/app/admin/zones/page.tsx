import type { Metadata } from "next";
import { deleteZoneAction, saveZoneAction, toggleZoneAction } from "@/actions/admin-ops";
import { ActionButton, ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/bits";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";
import { fcfa } from "@/lib/format";

export const metadata: Metadata = { title: "Zones de livraison" };

function ZoneForm({ z }: { z?: any }) {
  return (
    <ActionForm action={saveZoneAction.bind(null, z?.id ?? null)} className="grid gap-3 sm:grid-cols-4" reset={!z}>
      <div className="sm:col-span-2"><label className="label">Nom de la zone</label><input name="name" defaultValue={z?.name} required className="input" placeholder="Zone A — Centre" /></div>
      <div><label className="label">Tarif (FCFA)</label><input name="fee" type="number" min={0} step={50} defaultValue={z?.fee ?? 1000} required className="input" /></div>
      <label className="flex items-end gap-2 pb-3 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={z?.active ?? true} className="size-5 accent-electric-500" /> Disponible</label>
      <div><label className="label">Délai min (min)</label><input name="eta_min" type="number" min={5} defaultValue={z?.eta_min ?? 30} className="input" /></div>
      <div><label className="label">Délai max (min)</label><input name="eta_max" type="number" min={5} defaultValue={z?.eta_max ?? 60} className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Quartiers couverts</label><input name="description" defaultValue={z?.description} maxLength={200} className="input" /></div>
      <div className="sm:col-span-4"><Submit className="btn-primary btn-sm">Enregistrer</Submit></div>
    </ActionForm>
  );
}

export default async function Zones() {
  await requirePage("zones.manage", "/admin/zones");
  const zones = await query<any>("select z.*, (select count(*) from orders where zone_id = z.id) as orders from delivery_zones z order by sort_order, fee");
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Zones de livraison</h1>
      <details className="card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Nouvelle zone</summary><div className="mt-4"><ZoneForm /></div></details>
      <div className="grid gap-4 lg:grid-cols-2">{zones.map((z) => (
        <article key={z.id} className="card space-y-3 p-5">
          <div className="flex items-start justify-between gap-3"><div><h2 className="font-extrabold text-navy-900">{z.name} {z.active ? <Badge tone="green">Disponible</Badge> : <Badge tone="gray">Indisponible</Badge>}</h2><p className="text-sm text-muted">{z.description}</p>
            <p className="mt-1 text-sm"><b className="h-display text-2xl text-electric-500" style={{ textTransform: "none" }}>{fcfa(z.fee)}</b> · <Icon name="clock" size={14} className="inline" /> {z.eta_min}–{z.eta_max} min · {z.orders} commande(s)</p></div>
            <div className="flex gap-1"><ActionButton action={toggleZoneAction} args={[z.id]} className="btn-outline btn-sm">{z.active ? "Désactiver" : "Activer"}</ActionButton><ActionButton action={deleteZoneAction} args={[z.id]} confirm="Supprimer cette zone ?" className="btn-danger btn-sm"><Icon name="trash" size={14} /></ActionButton></div></div>
          <details><summary className="cursor-pointer text-sm font-bold text-electric-500">Modifier</summary><div className="mt-3"><ZoneForm z={z} /></div></details>
        </article>))}</div>
    </div>
  );
}
