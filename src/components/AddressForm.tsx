"use client";
import { saveAddressAction } from "@/actions/account";
import { displayPhone } from "@/lib/format";
import { ActionForm, Submit } from "./ui/ActionForm";

export function AddressForm({ a }: { a?: any }) {
  return (
    <ActionForm action={saveAddressAction.bind(null, a?.id ?? null)} className="grid gap-3 sm:grid-cols-2" reset={!a}>
      <div><label className="label">Nom de l&apos;adresse</label><input name="label" defaultValue={a?.label ?? "Domicile"} required className="input" /></div>
      <div><label className="label">Téléphone</label><input name="phone" defaultValue={a?.phone ? displayPhone(a.phone) : ""} required inputMode="tel" className="input" /></div>
      <div><label className="label">Commune</label><input name="commune" defaultValue={a?.commune ?? ""} required className="input" /></div>
      <div><label className="label">Quartier</label><input name="quartier" defaultValue={a?.quartier ?? ""} required className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Adresse</label><input name="address" defaultValue={a?.address ?? ""} required className="input" /></div>
      <div><label className="label">Point de repère</label><input name="landmark" defaultValue={a?.landmark ?? ""} className="input" /></div>
      <div><label className="label">Instructions au livreur</label><input name="instructions" defaultValue={a?.instructions ?? ""} className="input" /></div>
      <div className="sm:col-span-2"><Submit className="btn-primary btn-sm">Enregistrer</Submit></div>
    </ActionForm>
  );
}
