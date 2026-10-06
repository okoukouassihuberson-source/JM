import Link from "next/link";
import { fcfa, fmtDateTime } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, type OrderStatus } from "@/lib/orders";
import { Icon } from "../ui/Icon";

export function OrderCard({ o, href }: { o: any; href?: string }) {
  return (
    <Link href={href ?? `/mon-espace/commandes/${o.number}`} className="card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-pop">
      <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-electric-50 text-electric-500"><Icon name={o.delivery_method === "pickup" ? "pin" : "truck"} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-extrabold text-navy-900">{o.number}</span>
        <span className="block text-xs text-muted">{fmtDateTime(o.created_at)} · {o.items} article{o.items > 1 ? "s" : ""}</span>
      </span>
      <span className="text-right"><span className="block font-black text-navy-900">{fcfa(o.total)}</span><span className={`badge mt-1 ${STATUS_TONE[o.status as OrderStatus]}`}>{STATUS_LABEL[o.status as OrderStatus]}</span></span>
    </Link>
  );
}
