"use client";
import { useState } from "react";
import { setThresholdAction, stockMoveAction } from "@/actions/admin-ops";
import { num } from "@/lib/format";
import { ActionForm, Submit } from "../ui/ActionForm";
import { Icon } from "../ui/Icon";

export function StockRow({ r, manage }: { r: any; manage: boolean }) {
  const [open, setOpen] = useState(false);
  const low = r.available <= r.alert_threshold;
  return (
    <>
      <tr className={low ? "bg-warning-50/60" : ""}>
        <td className="td"><b className="block text-navy-900">{r.name}</b><span className="text-xs text-muted">{r.category}{!r.active && " · inactif"}</span></td>
        <td className="td font-bold">{num(r.on_hand)} {r.unit_label}</td>
        <td className="td">{num(r.reserved)} {r.unit_label}</td>
        <td className="td">{num(r.sold)} {r.unit_label}</td>
        <td className="td"><b className={r.available <= 0 ? "text-promo-600" : low ? "text-warning-600" : "text-success-600"}>{num(r.available)} {r.unit_label}</b>{low && <p className="flex items-center gap-1 text-[11px] font-bold text-warning-600"><Icon name="alert" size={12} /> Stock faible à partir de {num(r.alert_threshold)} {r.unit_label}</p>}</td>
        <td className="td">{num(r.alert_threshold)} {r.unit_label}</td>
        <td className="td">{manage && <button className="btn-outline btn-sm" onClick={() => setOpen(!open)}>{open ? "Fermer" : "Ajuster"}</button>}</td>
      </tr>
      {open && (
        <tr className="bg-electric-50/50"><td colSpan={7} className="px-4 py-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
            <ActionForm action={stockMoveAction.bind(null, r.id)} className="grid items-end gap-3 sm:grid-cols-[180px_130px_1fr_auto]" reset>
              <div><label className="label">Opération</label><select name="type" className="input"><option value="restock">Réception (+)</option><option value="loss">Perte / casse (−)</option><option value="adjustment">Correction (total réel)</option></select></div>
              <div><label className="label">Quantité ({r.unit_label})</label><input name="qty" type="number" step="0.001" min="0" required className="input" /></div>
              <div><label className="label">Note</label><input name="note" maxLength={200} className="input" placeholder="Arrivage du matin…" /></div>
              <Submit className="btn-primary">Valider</Submit>
            </ActionForm>
            <form className="flex items-end gap-2" onSubmit={async (e) => { e.preventDefault(); await setThresholdAction(r.id, Number(new FormData(e.currentTarget).get("thr"))); }}>
              <div><label className="label">Seuil d&apos;alerte</label><input name="thr" type="number" step="0.001" min="0" defaultValue={r.alert_threshold} className="input w-28" /></div><button className="btn-outline">OK</button>
            </form>
          </div>
        </td></tr>
      )}
    </>
  );
}
