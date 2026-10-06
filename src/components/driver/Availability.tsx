"use client";
import { setAvailabilityAction } from "@/actions/driver";
import { ActionButton } from "../ui/ActionForm";

export function Availability({ status }: { status: string }) {
  const label = { available: "Disponible", busy: "En livraison", unavailable: "Indisponible" }[status] ?? status;
  const tone = { available: "bg-success-50 text-success-600", busy: "bg-navy-900 text-white", unavailable: "bg-slate-200 text-slate-600" }[status];
  return (
    <div className="card flex items-center justify-between p-3.5">
      <span className="text-sm font-bold text-navy-900">Mon statut <span className={`badge ml-2 ${tone}`}>{label}</span></span>
      {status !== "busy" && <ActionButton action={() => setAvailabilityAction(status === "unavailable")} className="btn-outline btn-sm" successToast>{status === "unavailable" ? "Me rendre disponible" : "Me mettre indisponible"}</ActionButton>}
    </div>
  );
}
