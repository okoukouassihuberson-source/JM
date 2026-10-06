"use client";
import { setDriverStatusAction, toggleUserAction } from "@/actions/admin-ops";
import { displayPhone } from "@/lib/format";
import { ActionButton } from "../ui/ActionForm";

export function DriverRow({ r }: { r: any }) {
  const label = { available: "Disponible", busy: "En livraison", unavailable: "Indisponible" }[r.status as string];
  const tone = { available: "bg-success-50 text-success-600", busy: "bg-navy-900 text-white", unavailable: "bg-slate-200 text-slate-600" }[r.status as string];
  return (
    <tr className={r.active ? "" : "bg-slate-50 opacity-60"}>
      <td className="td"><b className="block text-navy-900">{r.first_name} {r.last_name}</b><span className="text-xs text-muted">{r.vehicle}{!r.active && " · compte désactivé"}</span></td>
      <td className="td"><a href={`tel:+${r.phone}`} className="font-semibold text-electric-500">{displayPhone(r.phone)}</a></td>
      <td className="td"><span className={`badge ${tone}`}>{label}</span></td>
      <td className="td font-bold">{r.today}{r.active_jobs > 0 && <span className="ml-1 text-xs font-normal text-muted">({r.active_jobs} en cours)</span>}</td>
      <td className="td font-bold text-success-600">{r.done}</td><td className="td font-bold text-promo-600">{r.failed}</td>
      <td className="td whitespace-nowrap text-right"><div className="flex justify-end gap-1">
        {r.status !== "busy" && <ActionButton action={() => setDriverStatusAction(r.id, r.status === "unavailable" ? "available" : "unavailable")} className="btn-outline btn-sm">{r.status === "unavailable" ? "Rendre dispo" : "Indisponible"}</ActionButton>}
        <ActionButton action={() => toggleUserAction(r.user_id)} confirm={r.active ? "Désactiver ce livreur ?" : undefined} className="btn-outline btn-sm">{r.active ? "Désactiver" : "Réactiver"}</ActionButton></div></td>
    </tr>
  );
}
