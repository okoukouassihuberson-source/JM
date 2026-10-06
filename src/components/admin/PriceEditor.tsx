"use client";
import { useState, useTransition } from "react";
import { quickPriceAction } from "@/actions/admin-catalog";
import { fcfa } from "@/lib/format";
import { useToast } from "../ui/Toast";
import { Icon } from "../ui/Icon";

export function PriceEditor({ id, price }: { id: string; price: number }) {
  const [edit, setEdit] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();
  if (!edit) return <button className="group flex items-center gap-1.5 font-black text-navy-900" onClick={() => setEdit(true)} title="Modifier le prix">{fcfa(price)}<Icon name="edit" size={13} className="text-muted opacity-0 transition group-hover:opacity-100" /></button>;
  return (
    <form className="flex items-center gap-1" onSubmit={(e) => { e.preventDefault(); const v = Number(new FormData(e.currentTarget).get("price")); start(async () => { const r = await quickPriceAction(id, v); toast(r.error ?? r.message ?? "OK", r.error ? "error" : "success"); if (!r.error) setEdit(false); }); }}>
      <input name="price" type="number" defaultValue={price} min={0} step={5} autoFocus className="input !min-h-9 w-24 !px-2 !py-1" aria-label="Nouveau prix" />
      <button disabled={pending} className="btn-primary btn-sm !px-2" aria-label="Valider"><Icon name="check" size={14} /></button>
      <button type="button" className="btn-outline btn-sm !px-2" onClick={() => setEdit(false)} aria-label="Annuler"><Icon name="x" size={14} /></button>
    </form>
  );
}
