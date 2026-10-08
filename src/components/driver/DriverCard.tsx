"use client";
import { useState } from "react";
import { acceptAction, arrivedAction, deliverAction, enRouteAction, failAction } from "@/actions/driver";
import { displayPhone, fcfa, formatQty } from "@/lib/format";
import { ActionButton, ActionForm, Submit } from "../ui/ActionForm";
import { Icon } from "../ui/Icon";

export function DriverCard({ d }: { d: any }) {
  const [mode, setMode] = useState<"" | "deliver" | "fail">("");
  const st = d.order_status as string;
  const accepted = !!d.accepted_at;
  const toCollect = d.payment_method === "cash_on_delivery" && d.pay_status !== "paid";
  return (
    <article className="card space-y-4 border-2 border-navy-900/10 p-4">
      <header className="flex items-start justify-between gap-2">
        <div><p className="text-xs font-bold uppercase tracking-widest text-electric-500">Commande</p><h3 className="h-display text-3xl text-navy-900">#{d.number}</h3></div>
        <span className={`badge ${st === "out_for_delivery" ? "bg-navy-900 text-white" : "bg-warning-50 text-warning-600"}`}>{d.delivery_status === "arrived" ? "Arrivé" : st === "out_for_delivery" ? "En route" : st === "handed_to_driver" ? "À livrer" : "En préparation"}</span>
      </header>
      <dl className="space-y-2.5 text-[15px]">
        <div className="flex gap-3"><Icon name="user" className="mt-0.5 shrink-0 text-electric-500" /><div><dt className="sr-only">Client</dt><dd className="font-bold">{d.customer_name}</dd></div></div>
        <div className="flex gap-3"><Icon name="phone" className="mt-0.5 shrink-0 text-electric-500" /><dd><a href={`tel:+${d.delivery_phone || d.customer_phone}`} className="font-bold text-electric-500 underline">{displayPhone(d.delivery_phone || d.customer_phone)}</a></dd></div>
        <div className="flex gap-3"><Icon name="pin" className="mt-0.5 shrink-0 text-electric-500" /><dd><b>{d.quartier}</b>{d.commune ? `, ${d.commune}` : ""}<br /><span className="text-muted">{d.address_line}{d.landmark ? ` — ${d.landmark}` : ""}</span></dd></div>
        {d.instructions && <div className="flex gap-3 rounded-xl bg-warning-50 p-3 text-sm"><Icon name="info" className="mt-0.5 shrink-0 text-warning-600" /><dd><b>Instructions :</b> {d.instructions}</dd></div>}
      </dl>
      <div className="flex items-center justify-between rounded-xl bg-electric-50 p-3">
        <div><p className="text-xs font-bold uppercase text-muted">Montant</p><p className="h-display text-3xl text-navy-900" style={{ textTransform: "none" }}>{fcfa(d.total)}</p></div>
        <span className={`badge ${toCollect ? "bg-promo-600 text-white" : "bg-success-50 text-success-600"}`}>{toCollect ? "À encaisser" : "Déjà payé"}</span>
      </div>
      <details className="text-sm"><summary className="cursor-pointer font-bold text-navy-900">Contenu ({d.items.length})</summary>
        <ul className="mt-2 space-y-1 text-muted">{d.items.map((i: any, k: number) => <li key={k}>• {i.name} — {formatQty(i.quantity, i)}</li>)}</ul></details>

      {!["handed_to_driver", "out_for_delivery"].includes(st) && <p className="rounded-xl bg-slate-100 p-3 text-center text-sm font-semibold text-muted">Commande assignée : en attente de sa préparation et de sa remise par la boutique.</p>}
      {!accepted && <ActionButton action={() => acceptAction(d.order_id)} className="btn-primary btn-lg w-full">ACCEPTER</ActionButton>}
      {accepted && st === "handed_to_driver" && <ActionButton action={() => enRouteAction(d.order_id)} className="btn-navy btn-lg w-full"><Icon name="nav" /> JE SUIS EN ROUTE</ActionButton>}
      {st === "out_for_delivery" && mode === "" && (
        <div className="grid gap-2">
          {d.delivery_status !== "arrived" && <ActionButton action={() => arrivedAction(d.order_id)} className="btn-outline btn-lg w-full"><Icon name="pin" /> JE SUIS ARRIVÉ</ActionButton>}
          <button className="btn-primary btn-lg w-full" onClick={() => setMode("deliver")}><Icon name="check" /> LIVRÉE</button>
          <button className="btn-danger w-full" onClick={() => setMode("fail")}>ÉCHEC DE LIVRAISON</button>
        </div>
      )}
      {mode === "deliver" && (
        <ActionForm action={deliverAction.bind(null, d.order_id)} className="space-y-3 rounded-2xl border-2 border-electric-500 p-4">
          <p className="font-extrabold text-navy-900">Confirmer la livraison</p>
          <div><label className="label">Code donné par le client</label><input name="code" inputMode="numeric" maxLength={4} className="input text-center text-3xl font-black tracking-[0.5em]" placeholder="••••" autoComplete="off" /></div>
          <div><label className="label">Photo de preuve (facultatif)</label><input type="file" name="photo" accept="image/jpeg,image/png,image/webp" capture="environment" className="input !py-2 text-sm" /></div>
          <div><label className="label">Commentaire</label><input name="comment" maxLength={300} className="input" placeholder="Remis en main propre…" /></div>
          {toCollect && <p className="rounded-xl bg-promo-50 p-3 text-sm font-bold text-promo-600">N&apos;oubliez pas d&apos;encaisser {fcfa(d.total)} en espèces.</p>}
          <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-outline" onClick={() => setMode("")}>Retour</button><Submit className="btn-primary" pendingText="Envoi…">Valider</Submit></div>
        </ActionForm>
      )}
      {mode === "fail" && (
        <ActionForm action={failAction.bind(null, d.order_id)} className="space-y-3 rounded-2xl border-2 border-promo-600 p-4">
          <p className="font-extrabold text-promo-600">Échec de livraison</p>
          <select name="reason" required className="input"><option value="">Choisir une raison…</option><option>Client injoignable</option><option>Adresse introuvable</option><option>Client absent</option><option>Commande refusée</option><option>Autre incident</option></select>
          <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-outline" onClick={() => setMode("")}>Retour</button><Submit className="btn-promo">Confirmer</Submit></div>
        </ActionForm>
      )}
    </article>
  );
}
