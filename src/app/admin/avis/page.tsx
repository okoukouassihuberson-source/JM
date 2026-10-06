import type { Metadata } from "next";
import { moderateReviewAction } from "@/actions/admin-catalog";
import { ActionButton } from "@/components/ui/ActionForm";
import { Badge, Empty, Stars } from "@/components/ui/bits";
import { query } from "@/db";
import { requirePage } from "@/lib/auth";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Avis clients" };

export default async function Avis() {
  await requirePage("reviews.moderate", "/admin/avis");
  const rows = await query<any>("select r.*, u.first_name, u.last_name, p.name as product from reviews r join users u on u.id = r.user_id join products p on p.id = r.product_id order by r.created_at desc limit 100");
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Avis clients</h1>
      {rows.length === 0 ? <Empty icon="star" title="Aucun avis" text="Les avis apparaissent après la livraison des commandes." /> : (
        <ul className="grid gap-3 lg:grid-cols-2">{rows.map((r) => (
          <li key={r.id} className={`card space-y-2 p-4 ${r.status === "hidden" ? "opacity-60" : ""}`}>
            <div className="flex items-center justify-between"><Stars value={r.rating} size={16} /><span className="text-xs text-muted">{fmtDate(r.created_at)}</span></div>
            <p className="text-sm">{r.comment || <i className="text-muted">Sans commentaire</i>}</p>
            <p className="text-xs text-muted"><b className="text-navy-900">{r.first_name} {r.last_name}</b> sur <b>{r.product}</b> {r.status === "hidden" && <Badge tone="gray">Masqué</Badge>}</p>
            <div className="flex gap-2">{r.status === "hidden" ? <ActionButton action={moderateReviewAction} args={[r.id, "show"]} className="btn-outline btn-sm">Publier</ActionButton> : <ActionButton action={moderateReviewAction} args={[r.id, "hide"]} className="btn-outline btn-sm">Masquer</ActionButton>}
              <ActionButton action={moderateReviewAction} args={[r.id, "delete"]} confirm="Supprimer cet avis ?" className="btn-danger btn-sm">Supprimer</ActionButton></div>
          </li>))}</ul>)}
    </div>
  );
}
