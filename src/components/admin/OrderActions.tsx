"use client";
import { useState } from "react";
import { assignDriverAction, cancelWithReasonAction, confirmPaymentAction, setStatusAction } from "@/actions/admin-orders";
import { ActionButton, ActionForm, Submit } from "../ui/ActionForm";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";

type Driver = { id: string; name: string; status: string };

export function DriverSelect({ orderId, drivers, current }: { orderId: string; drivers: Driver[]; current?: string | null }) {
  const toast = useToast();
  return (
    <select aria-label="Affecter un livreur" defaultValue={current ?? ""} className="input !min-h-9 !w-auto !py-1 text-xs"
      onChange={async (e) => { if (!e.target.value) return; const r = await assignDriverAction(orderId, e.target.value); toast(r.error ?? r.message ?? "OK", r.error ? "error" : "success"); }}>
      <option value="">Affecter…</option>
      {drivers.map((d) => <option key={d.id} value={d.id}>{d.name} ({d.status === "available" ? "dispo" : d.status === "busy" ? "en livraison" : "indispo"})</option>)}
    </select>
  );
}

export function OrderActions({ o, drivers }: { o: { id: string; status: string; pickup: boolean; cod: boolean; paid: boolean; driverId: string | null }; drivers: Driver[] }) {
  const [cancel, setCancel] = useState(false);
  const st = o.status;
  const act = (to: string, label: string, cls = "btn-primary", icon?: any) => (
    <ActionButton action={() => setStatusAction(o.id, to)} className={`${cls} w-full`}>{icon && <Icon name={icon} size={18} />}{label}</ActionButton>
  );
  const final = ["delivered", "cancelled"].includes(st);
  return (
    <div className="space-y-3">
      {st === "received" && !o.cod && !o.paid && <ActionButton action={() => confirmPaymentAction(o.id)} className="btn-primary w-full"><Icon name="wallet" size={18} /> Confirmer le paiement</ActionButton>}
      {st === "received" && (o.cod || o.paid) && act("preparing", "Préparer la commande", "btn-primary", "package")}
      {st === "payment_confirmed" && act("preparing", "Préparer la commande", "btn-primary", "package")}
      {st === "preparing" && o.pickup && act("ready", "Marquer prête (retrait)", "btn-primary", "check")}
      {st === "ready" && act("delivered", "Remise au client — terminée", "btn-primary", "check")}
      {!o.pickup && !final && ["preparing", "handed_to_driver", "delivery_failed", "received", "payment_confirmed"].includes(st) && (
        <div className="rounded-2xl bg-electric-50 p-3"><p className="label">Livreur</p><DriverSelect orderId={o.id} drivers={drivers} current={o.driverId} /></div>
      )}
      {(st === "preparing" || st === "delivery_failed") && !o.pickup && o.driverId && act("handed_to_driver", "Remettre au livreur", "btn-navy", "truck")}
      {st === "handed_to_driver" && act("out_for_delivery", "Marquer en livraison", "btn-navy", "nav")}
      {st === "out_for_delivery" && (<>{act("delivered", "Marquer livrée", "btn-primary", "check")}{act("delivery_failed", "Échec de livraison", "btn-danger")}</>)}
      {!final && !cancel && <button type="button" className="btn-danger w-full" onClick={() => setCancel(true)}>Annuler la commande</button>}
      {cancel && (
        <ActionForm action={cancelWithReasonAction.bind(null, o.id)} className="space-y-2 rounded-2xl border-2 border-promo-600 p-3">
          <label className="label">Motif d&apos;annulation</label><input name="reason" required maxLength={200} className="input" placeholder="Rupture, client injoignable…" />
          <p className="text-xs text-muted">Le stock réservé sera libéré et le client notifié.</p>
          <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-outline btn-sm" onClick={() => setCancel(false)}>Retour</button><Submit className="btn-promo btn-sm">Confirmer l&apos;annulation</Submit></div>
        </ActionForm>
      )}
    </div>
  );
}
