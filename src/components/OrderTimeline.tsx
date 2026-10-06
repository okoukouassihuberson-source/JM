import { fmtDate, fmtTime } from "@/lib/format";
import { STATUS_LABEL, type OrderStatus } from "@/lib/orders";
import { Icon } from "./ui/Icon";

type H = { status: string; created_at: Date | string; note: string | null };

const FLOW: OrderStatus[] = ["received", "payment_confirmed", "preparing", "handed_to_driver", "out_for_delivery", "delivered"];
const PICKUP: OrderStatus[] = ["received", "payment_confirmed", "preparing", "ready", "delivered"];
const LABEL: Partial<Record<OrderStatus, string>> = { handed_to_driver: "Commande remise au livreur", ready: "Commande prête au retrait", delivered: "Livrée", preparing: "Préparation" };

export function OrderTimeline({ status, history, pickup, cod }: { status: OrderStatus; history: H[]; pickup: boolean; cod: boolean }) {
  const flow = pickup ? PICKUP : FLOW;
  const cancelled = status === "cancelled", failed = status === "delivery_failed";
  const reached = new Set(history.map((h) => h.status));
  const first = (s: string) => history.find((h) => h.status === s);
  let idx = flow.indexOf(status);
  if (failed) idx = flow.indexOf("out_for_delivery");
  if (cancelled) idx = Math.max(-1, ...history.map((h) => flow.indexOf(h.status as OrderStatus)));
  const done = status === "delivered";

  const steps = flow.map((s, i) => {
    const h = first(s);
    const codStep = cod && s === "payment_confirmed";
    let state: "done" | "current" | "todo" = i < idx || done ? "done" : i === idx ? "current" : "todo";
    if (codStep && !done) state = "todo";
    if (!h && state === "done" && !codStep) state = "done";
    return { s, h, state, label: codStep ? "Paiement à la livraison" : (LABEL[s] ?? STATUS_LABEL[s]), codStep };
  });
  if (cancelled) steps.push({ s: "cancelled" as OrderStatus, h: first("cancelled"), state: "current", label: "Commande annulée", codStep: false });
  void reached;

  return (
    <ol className="relative">
      {steps.map((st, i) => {
        const last = i === steps.length - 1;
        const bad = st.s === "cancelled";
        return (
          <li key={st.s} className="relative flex gap-4 pb-6 last:pb-0">
            {!last && <span className={`absolute left-[17px] top-9 h-[calc(100%-2.25rem)] w-0.5 ${st.state === "done" ? "bg-electric-500" : "bg-line"}`} />}
            <span className={`relative z-10 grid size-9 shrink-0 place-items-center rounded-full border-2 transition ${bad ? "border-promo-600 bg-promo-600 text-white" : st.state === "done" ? "border-electric-500 bg-electric-500 text-white" : st.state === "current" ? "animate-pulse-ring border-electric-500 bg-white text-electric-500" : "border-line bg-white text-slate-300"}`}>
              {bad ? <Icon name="x" size={18} /> : st.state === "done" ? <Icon name="check" size={18} /> : <span className={`size-2.5 rounded-full ${st.state === "current" ? "bg-electric-500" : "bg-slate-300"}`} />}
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className={`font-extrabold ${st.state === "todo" ? "text-muted" : bad ? "text-promo-600" : "text-navy-900"}`}>{st.label}</p>
              <p className="text-xs text-muted">
                {st.h ? `${fmtDate(st.h.created_at)} · ${fmtTime(st.h.created_at)}` : st.codStep ? "À régler au livreur" : st.state === "todo" ? "À venir" : ""}
                {st.h && <span className="ml-2 font-bold text-success-600">{bad ? "" : "Terminé"}</span>}
                {!st.h && st.state === "current" && <span className="ml-2 font-bold text-electric-500">En cours</span>}
              </p>
              {st.h?.note && st.s !== "received" && <p className="mt-0.5 text-xs text-ink/70">{st.h.note}</p>}
            </div>
          </li>
        );
      })}
      {failed && (
        <li className="mt-4 flex items-start gap-2 rounded-xl bg-promo-50 p-3 text-sm font-semibold text-promo-600"><Icon name="alert" size={18} className="mt-0.5 shrink-0" />La livraison n&apos;a pas pu aboutir{first("delivery_failed")?.note ? ` : ${first("delivery_failed")!.note}` : ""}. Nous vous recontactons.</li>
      )}
    </ol>
  );
}
