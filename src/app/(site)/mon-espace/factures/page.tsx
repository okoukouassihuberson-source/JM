import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { Empty } from "@/components/ui/bits";
import { query } from "@/db";
import { requireUser } from "@/lib/auth";
import { fcfa, fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Mes factures" };

export default async function Factures() {
  const u = await requireUser("/mon-espace/factures");
  const rows = await query<any>("select i.number, i.issued_at, i.total, o.number as order_number from invoices i join orders o on o.id = i.order_id where o.user_id = $1 order by i.issued_at desc", [u.id]);
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Mes factures</h1>
      {rows.length === 0 ? <Empty icon="receipt" title="Aucune facture" text="Une facture est générée automatiquement à chaque commande." /> : (
        <ul className="space-y-2">{rows.map((r) => (
          <li key={r.number} className="card flex items-center gap-4 p-4"><span className="grid size-11 place-items-center rounded-xl bg-electric-50 text-electric-500"><Icon name="receipt" /></span>
            <span className="min-w-0 flex-1"><b className="block text-navy-900">{r.number}</b><span className="text-xs text-muted">{fmtDate(r.issued_at)} · commande {r.order_number}</span></span>
            <b>{fcfa(r.total)}</b><a href={`/api/invoices/${r.order_number}`} className="btn-outline btn-sm"><Icon name="download" size={16} /> PDF</a></li>))}</ul>)}
    </div>
  );
}
