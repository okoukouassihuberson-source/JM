import type { Metadata } from "next";
import { defaultAddressAction, deleteAddressAction } from "@/actions/account";
import { AddressForm } from "@/components/AddressForm";
import { ActionButton } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { displayPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Mes adresses" };

export default async function Adresses() {
  const u = await requireUser("/mon-espace/adresses");
  const list = await query<any>("select * from addresses where user_id = $1 order by is_default desc, created_at", [u.id]);
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Mes adresses</h1>
      <details className="card group p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Ajouter une adresse</summary><div className="mt-4"><AddressForm /></div></details>
      {list.map((a) => (
        <article key={a.id} className="card space-y-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="flex items-center gap-2 font-extrabold text-navy-900">{a.label} {a.is_default && <Badge tone="green">Par défaut</Badge>}</p>
              <p className="mt-1 text-sm text-muted">{a.address}, {a.quartier}, {a.commune}{a.landmark ? ` — ${a.landmark}` : ""}</p>
              {a.phone && <p className="text-sm text-muted">{displayPhone(a.phone)}</p>}</div>
            <div className="flex gap-2">
              {!a.is_default && <ActionButton action={defaultAddressAction} args={[a.id]} className="btn-outline btn-sm">Par défaut</ActionButton>}
              <ActionButton action={deleteAddressAction} args={[a.id]} confirm="Supprimer cette adresse ?" className="btn-danger btn-sm"><Icon name="trash" size={14} /></ActionButton>
            </div>
          </div>
          <details><summary className="cursor-pointer text-sm font-bold text-electric-500">Modifier</summary><div className="mt-3"><AddressForm a={a} /></div></details>
        </article>
      ))}
    </div>
  );
}
