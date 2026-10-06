"use client";
import { useMemo, useState } from "react";
import { placeOrderAction } from "@/actions/checkout";
import { fcfa } from "@/lib/format";
import { deliveryFee, type DeliveryMethod } from "@/lib/pricing";
import { ActionForm, Submit } from "./ui/ActionForm";
import { Icon } from "./ui/Icon";

type Zone = { id: string; name: string; description: string; fee: number; eta_min: number; eta_max: number };
type Addr = { id: string; label: string; commune: string; quartier: string; address: string; landmark: string | null; phone: string | null; instructions: string | null; is_default: boolean };
type Props = {
  user: { name: string; phone: string };
  cart: { subtotal: number; discount: number; lines: { id: string; name: string; qty: string; total: number }[] };
  zones: Zone[]; addresses: Addr[];
  opts: { expressSupplement: number; freeThreshold: number; expressEnabled: boolean; pickupEnabled: boolean; cod: boolean; momo: boolean; momoInfo: string; online: boolean; shopAddress: string; hours: string };
};

const STEPS = ["Vos informations", "Adresse", "Livraison", "Paiement"];

export function CheckoutForm({ user, cart, zones, addresses, opts }: Props) {
  const def = addresses.find((a) => a.is_default) ?? addresses[0];
  const [step, setStep] = useState(1);
  const [err, setErr] = useState("");
  const [f, setF] = useState({
    customerName: user.name, customerPhone: user.phone, zoneId: zones[0]?.id ?? "",
    commune: def?.commune ?? "", quartier: def?.quartier ?? "", address: def?.address ?? "", landmark: def?.landmark ?? "", deliveryPhone: def?.phone ?? user.phone, instructions: def?.instructions ?? "",
  });
  const [method, setMethod] = useState<DeliveryMethod>("standard");
  const [pay, setPay] = useState(opts.cod ? "cash_on_delivery" : opts.momo ? "mobile_money" : "online");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF((s) => ({ ...s, [k]: e.target.value }));
  const zone = zones.find((z) => z.id === f.zoneId);
  const after = cart.subtotal - cart.discount;
  const fee = useMemo(() => deliveryFee(method, zone?.fee ?? 0, { expressSupplement: opts.expressSupplement, freeThreshold: opts.freeThreshold }, after), [method, zone, after, opts]);
  const total = after + fee;

  const next = () => {
    setErr("");
    if (step === 1 && (f.customerName.trim().length < 3 || f.customerPhone.replace(/\D/g, "").length < 8)) return setErr("Indiquez votre nom complet et un numéro de téléphone valide.");
    if (step === 2 && method !== "pickup" && (!f.zoneId || f.commune.trim().length < 2 || f.quartier.trim().length < 2 || f.address.trim().length < 3)) return setErr("Renseignez la zone, la commune, le quartier et l'adresse (ou choisissez le retrait sur place).");
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => { setErr(""); setStep((s) => s - 1); };
  const fill = (a: Addr) => setF((s) => ({ ...s, commune: a.commune, quartier: a.quartier, address: a.address, landmark: a.landmark ?? "", deliveryPhone: a.phone ?? s.deliveryPhone, instructions: a.instructions ?? "" }));
  const show = (n: number) => (step === n ? "" : "hidden");

  const methods: { id: DeliveryMethod; title: string; text: string; price: string; icon: any; ok: boolean }[] = [
    { id: "standard", title: "Livraison standard", text: zone ? `${zone.eta_min}–${zone.eta_max} min` : "Selon votre zone", price: fcfa(deliveryFee("standard", zone?.fee ?? 0, { expressSupplement: opts.expressSupplement, freeThreshold: opts.freeThreshold }, after)), icon: "truck", ok: true },
    { id: "express", title: "Livraison express", text: zone ? `Prioritaire · ~${Math.round(zone.eta_min * 0.6)}–${Math.round(zone.eta_max * 0.6)} min` : "Prioritaire", price: fcfa((zone?.fee ?? 0) + opts.expressSupplement), icon: "nav", ok: opts.expressEnabled },
    { id: "pickup", title: "Retrait sur place", text: opts.shopAddress, price: "Gratuit", icon: "pin", ok: opts.pickupEnabled },
  ];

  return (
    <ActionForm action={placeOrderAction} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div>
        <ol className="mb-6 grid grid-cols-4 gap-1.5" aria-label="Étapes de la commande">
          {STEPS.map((t, i) => (
            <li key={t} className="text-center">
              <span className={`mb-1 block h-1.5 rounded-full transition-all ${i + 1 <= step ? "bg-electric-500" : "bg-line"}`} />
              <span className={`text-[11px] font-bold uppercase tracking-wide sm:text-xs ${i + 1 === step ? "text-navy-900" : "text-muted"}`}><span className="hidden sm:inline">{i + 1}. </span>{t}</span>
            </li>
          ))}
        </ol>

        {err && <p role="alert" className="mb-4 flex gap-2 rounded-xl bg-promo-50 px-3.5 py-3 text-sm font-semibold text-promo-600"><Icon name="alert" size={18} className="shrink-0" />{err}</p>}

        {/* 1 */}
        <section className={`card space-y-4 p-5 ${show(1)}`}>
          <h2 className="h-display text-3xl text-navy-900">Vos informations</h2>
          <div><label className="label" htmlFor="cn">Nom complet</label><input id="cn" name="customerName" value={f.customerName} onChange={set("customerName")} className="input" autoComplete="name" /></div>
          <div><label className="label" htmlFor="cp">Téléphone</label><input id="cp" name="customerPhone" value={f.customerPhone} onChange={set("customerPhone")} className="input" inputMode="tel" autoComplete="tel" /></div>
        </section>

        {/* 2 */}
        <section className={`card space-y-4 p-5 ${show(2)}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="h-display text-3xl text-navy-900">Adresse de livraison</h2>
            {opts.pickupEnabled && <button type="button" className="text-sm font-bold text-electric-500 underline" onClick={() => { setMethod("pickup"); setErr(""); setStep(3); }}>Je retire sur place →</button>}
          </div>
          {addresses.length > 0 && (
            <div className="flex flex-wrap gap-2">{addresses.map((a) => <button key={a.id} type="button" onClick={() => fill(a)} className="btn-outline btn-sm"><Icon name="pin" size={14} />{a.label} · {a.quartier}</button>)}</div>
          )}
          <div>
            <label className="label" htmlFor="zone">Zone de livraison</label>
            <select id="zone" name="zoneId" value={f.zoneId} onChange={set("zoneId")} className="input">
              {zones.map((z) => <option key={z.id} value={z.id}>{z.name} — {fcfa(z.fee)} ({z.eta_min}–{z.eta_max} min)</option>)}
            </select>
            {zone?.description && <p className="mt-1 text-xs text-muted">{zone.description}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="co">Commune</label><input id="co" name="commune" value={f.commune} onChange={set("commune")} className="input" /></div>
            <div><label className="label" htmlFor="qu">Quartier</label><input id="qu" name="quartier" value={f.quartier} onChange={set("quartier")} className="input" /></div>
          </div>
          <div><label className="label" htmlFor="ad">Adresse</label><input id="ad" name="address" value={f.address} onChange={set("address")} className="input" placeholder="Rue, numéro, immeuble…" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><label className="label" htmlFor="lm">Point de repère</label><input id="lm" name="landmark" value={f.landmark} onChange={set("landmark")} className="input" placeholder="Près de la pharmacie…" /></div>
            <div><label className="label" htmlFor="dp">Téléphone de livraison</label><input id="dp" name="deliveryPhone" value={f.deliveryPhone} onChange={set("deliveryPhone")} className="input" inputMode="tel" /></div>
          </div>
          <div><label className="label" htmlFor="in">Instructions au livreur</label><textarea id="in" name="instructions" value={f.instructions} onChange={set("instructions")} rows={2} maxLength={300} className="input" placeholder="Appelez en arrivant, portail bleu…" /></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="saveAddress" defaultChecked className="size-5 accent-electric-500" /> Enregistrer cette adresse</label>
        </section>

        {/* 3 */}
        <section className={`card space-y-3 p-5 ${show(3)}`}>
          <h2 className="h-display text-3xl text-navy-900">Mode de livraison</h2>
          {methods.filter((m) => m.ok).map((m) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line p-4 transition has-[:checked]:border-electric-500 has-[:checked]:bg-electric-50">
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)} className="size-5 accent-electric-500" />
              <Icon name={m.icon} className="text-electric-500" />
              <span className="flex-1"><span className="block font-extrabold text-navy-900">{m.title}</span><span className="block text-xs text-muted">{m.text}</span></span>
              <span className="font-black text-navy-900">{m.price}</span>
            </label>
          ))}
          {method === "pickup" && <p className="rounded-xl bg-electric-50 p-3 text-sm"><b>Retrait :</b> {opts.shopAddress}. {opts.hours}</p>}
        </section>

        {/* 4 */}
        <section className={`card space-y-3 p-5 ${show(4)}`}>
          <h2 className="h-display text-3xl text-navy-900">Paiement</h2>
          {[
            opts.cod && { id: "cash_on_delivery", t: "Paiement à la livraison", d: method === "pickup" ? "Réglez en espèces au retrait." : "Réglez en espèces à la réception.", i: "wallet" },
            opts.momo && { id: "mobile_money", t: "Mobile Money (Orange, MTN, Moov, Wave)", d: "Envoyez le montant puis indiquez la référence.", i: "phone" },
            opts.online && { id: "online", t: "Payer en ligne (Mobile Money / carte)", d: "Paiement sécurisé via CinetPay.", i: "lock" },
          ].filter(Boolean).map((m: any) => (
            <label key={m.id} className="flex cursor-pointer items-center gap-3 rounded-2xl border-2 border-line p-4 transition has-[:checked]:border-electric-500 has-[:checked]:bg-electric-50">
              <input type="radio" name="paymentMethod" value={m.id} checked={pay === m.id} onChange={() => setPay(m.id)} className="size-5 accent-electric-500" />
              <Icon name={m.i} className="text-electric-500" />
              <span className="flex-1"><span className="block font-extrabold text-navy-900">{m.t}</span><span className="block text-xs text-muted">{m.d}</span></span>
            </label>
          ))}
          {pay === "mobile_money" && (
            <div className="space-y-3 rounded-2xl bg-electric-50 p-4 text-sm">
              <p className="font-bold text-navy-900">Envoyez <span className="text-electric-500">{fcfa(total)}</span> à :</p>
              <p className="whitespace-pre-line font-semibold">{opts.momoInfo}</p>
              <div><label className="label" htmlFor="ref">Référence de la transaction (facultatif maintenant)</label><input id="ref" name="paymentReference" className="input" maxLength={40} placeholder="Ex : MP260906.1234.A56789" /></div>
              <p className="text-xs text-muted">Votre commande sera préparée dès confirmation de la réception du paiement.</p>
            </div>
          )}
          {pay !== "mobile_money" && <input type="hidden" name="paymentReference" value="" />}
          {pay === "online" && <p className="rounded-xl bg-electric-50 p-3 text-sm">Après validation, vous serez redirigé vers la page de paiement sécurisée.</p>}
        </section>

        <div className="mt-5 flex justify-between gap-3">
          {step > 1 ? <button type="button" onClick={back} className="btn-outline"><Icon name="left" size={18} /> Retour</button> : <span />}
          {step < 4 ? <button type="button" onClick={next} className="btn-primary btn-lg">Continuer <Icon name="right" size={18} /></button> : <Submit className="btn-primary btn-lg" pendingText="Validation…">CONFIRMER LA COMMANDE · {fcfa(total)}</Submit>}
        </div>
      </div>

      <aside className="lg:sticky lg:top-32 lg:self-start">
        <div className="card space-y-3 p-5">
          <h2 className="h-display text-2xl text-navy-900">Votre commande</h2>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">{cart.lines.map((l) => <li key={l.id} className="flex justify-between gap-3"><span className="min-w-0"><span className="block truncate font-bold">{l.name}</span><span className="text-xs text-muted">{l.qty}</span></span><span className="font-bold">{fcfa(l.total)}</span></li>)}</ul>
          <dl className="space-y-1.5 border-t border-line pt-3 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Sous-total</dt><dd className="font-bold">{fcfa(cart.subtotal)}</dd></div>
            {cart.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Réduction</dt><dd className="font-bold text-promo-600">- {fcfa(cart.discount)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Livraison{method === "pickup" ? " (retrait)" : zone ? ` (${zone.name.split(" — ")[0]})` : ""}</dt><dd className="font-bold">{fee ? fcfa(fee) : "Offerte"}</dd></div>
            <div className="flex items-end justify-between border-t border-line pt-3"><dt className="font-extrabold uppercase text-navy-900">Total</dt><dd className="h-display text-3xl text-navy-900" style={{ textTransform: "none" }}>{fcfa(total)}</dd></div>
          </dl>
        </div>
      </aside>
    </ActionForm>
  );
}
