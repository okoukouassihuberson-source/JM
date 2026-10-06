"use client";
import Image from "next/image";
import { useState } from "react";
import { saveProductAction } from "@/actions/admin-catalog";
import { ActionForm, Submit } from "../ui/ActionForm";

const PRESETS: Record<string, { label: string; step: number; min: number; custom: boolean }> = {
  kg: { label: "kg", step: 0.5, min: 0.5, custom: true }, piece: { label: "pièce", step: 1, min: 1, custom: false },
  pack: { label: "paquet", step: 1, min: 1, custom: false }, tray: { label: "plateau", step: 1, min: 1, custom: false }, custom: { label: "unité", step: 1, min: 1, custom: true },
};

export function ProductForm({ p, categories, images = [], variants = [], inv, canStock }: { p?: any; categories: { id: string; name: string }[]; images?: { id: string; url: string }[]; variants?: { name: string; price: number }[]; inv?: { on_hand: number; reserved: number; alert_threshold: number }; canStock: boolean }) {
  const [unit, setUnit] = useState<string>(p?.unit ?? "kg");
  const [label, setLabel] = useState(p?.unit_label ?? "kg");
  const [step, setStep] = useState(String(p?.step ?? 0.5));
  const [min, setMin] = useState(String(p?.min_qty ?? 0.5));
  const [custom, setCustom] = useState<boolean>(p?.allow_custom_qty ?? true);
  const [promo, setPromo] = useState<boolean>(p?.promo_active ?? false);
  const onUnit = (u: string) => { const x = PRESETS[u]; setUnit(u); setLabel(x.label); setStep(String(x.step)); setMin(String(x.min)); setCustom(x.custom); };
  return (
    <ActionForm action={saveProductAction.bind(null, p?.id ?? null)} className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="h-display text-2xl text-navy-900 sm:col-span-2">Informations</h2>
          <div className="sm:col-span-2"><label className="label" htmlFor="name">Nom du produit</label><input id="name" name="name" defaultValue={p?.name} required className="input" /></div>
          <div><label className="label" htmlFor="cat">Catégorie</label><select id="cat" name="category_id" defaultValue={p?.category_id} required className="input">{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label" htmlFor="price">Prix par {label} (FCFA)</label><input id="price" name="price" type="number" min={0} step={5} defaultValue={p?.price} required className="input" /></div>
          <div className="sm:col-span-2"><label className="label" htmlFor="desc">Description</label><textarea id="desc" name="description" rows={4} maxLength={3000} defaultValue={p?.description} className="input" /></div>
        </section>
        <section className="card grid gap-4 p-5 sm:grid-cols-2">
          <h2 className="h-display text-2xl text-navy-900 sm:col-span-2">Unité de vente</h2>
          <div><label className="label" htmlFor="unit">Type d&apos;unité</label><select id="unit" name="unit" value={unit} onChange={(e) => onUnit(e.target.value)} className="input"><option value="kg">Kilogramme (500 g, 1 kg…)</option><option value="piece">Pièce</option><option value="pack">Paquet</option><option value="tray">Plateau</option><option value="custom">Personnalisée</option></select></div>
          <div><label className="label" htmlFor="ul">Libellé affiché</label><input id="ul" name="unit_label" value={label} onChange={(e) => setLabel(e.target.value)} required className="input" /></div>
          <div><label className="label" htmlFor="st">Pas d&apos;incrément</label><input id="st" name="step" type="number" step="0.01" min="0.01" value={step} onChange={(e) => setStep(e.target.value)} className="input" /></div>
          <div><label className="label" htmlFor="mq">Quantité minimale</label><input id="mq" name="min_qty" type="number" step="0.01" min="0.01" value={min} onChange={(e) => setMin(e.target.value)} className="input" /></div>
          <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><input type="checkbox" name="allow_custom_qty" checked={custom} onChange={(e) => setCustom(e.target.checked)} className="size-5 accent-electric-500" /> Autoriser une quantité personnalisée (saisie libre, ex. 1,25 kg)</label>
          <p className="text-xs text-muted sm:col-span-2">Exemple kg : pas 0,5 → le client choisit 500 g, 1 kg, 1,5 kg… Le prix se calcule automatiquement (500 g = moitié du prix au kilo).</p>
        </section>
        <section className="card space-y-4 p-5">
          <h2 className="h-display text-2xl text-navy-900">Promotion</h2>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="promo_active" checked={promo} onChange={(e) => setPromo(e.target.checked)} className="size-5 accent-promo-600" /> Mettre en promotion</label>
          <div className={`grid gap-4 sm:grid-cols-2 ${promo ? "" : "opacity-50"}`}><div><label className="label">Prix promotionnel (FCFA)</label><input name="promo_price" type="number" min={0} step={5} defaultValue={p?.promo_price ?? ""} className="input" /></div>
            <div><label className="label">Fin de l&apos;offre (facultatif)</label><input name="promo_ends_at" type="date" defaultValue={p?.promo_ends_at ? new Date(p.promo_ends_at).toISOString().slice(0, 10) : ""} className="input" /></div></div>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="h-display text-2xl text-navy-900">Variantes (facultatif)</h2>
          <textarea name="variants" rows={4} defaultValue={variants.map((v) => `${v.name} | ${v.price}`).join("\n")} className="input font-mono text-sm" placeholder={"Petit (1,2 kg) | 3000\nMoyen (1,5 kg) | 3500"} />
          <p className="text-xs text-muted">Une variante par ligne : <code>Nom | prix par {label}</code>. Le client doit alors choisir une option.</p>
        </section>
      </div>
      <div className="space-y-5">
        <section className="card space-y-3 p-5">
          <h2 className="h-display text-2xl text-navy-900">Publication</h2>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={p?.active ?? true} className="size-5 accent-electric-500" /> Produit actif (visible en boutique)</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="featured" defaultChecked={p?.featured ?? false} className="size-5 accent-electric-500" /> Produit vedette (page d&apos;accueil)</label>
        </section>
        {canStock && (
          <section className="card space-y-3 p-5">
            <h2 className="h-display text-2xl text-navy-900">Stock</h2>
            <div><label className="label">Stock en rayon ({label})</label><input name="stock" type="number" step="0.001" min={0} defaultValue={inv?.on_hand ?? 0} className="input" /></div>
            <div><label className="label">Seuil d&apos;alerte ({label})</label><input name="alert_threshold" type="number" step="0.001" min={0} defaultValue={inv?.alert_threshold ?? 10} className="input" /></div>
            {inv && <p className="text-xs text-muted">Réservé par des commandes en cours : <b>{inv.reserved}</b> {label}</p>}
          </section>
        )}
        <section className="card space-y-3 p-5">
          <h2 className="h-display text-2xl text-navy-900">Photos</h2>
          {images.length > 0 && <ul className="grid grid-cols-3 gap-2">{images.map((im, i) => (
            <li key={im.id} className="space-y-1 text-[11px]"><div className="relative aspect-square overflow-hidden rounded-xl border border-line"><Image src={im.url} alt="" fill sizes="110px" className="object-cover" /></div>
              <label className="flex items-center gap-1"><input type="radio" name="main_image" value={im.id} defaultChecked={i === 0} /> Principale</label>
              <label className="flex items-center gap-1 text-promo-600"><input type="checkbox" name="remove_image" value={im.id} /> Supprimer</label></li>))}</ul>}
          <div><label className="label">Ajouter des photos</label><input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="input !py-2 text-sm" /><p className="mt-1 text-xs text-muted">JPEG/PNG/WebP, 6 Mo max par image, jusqu&apos;à 6 photos. Compression WebP automatique.</p></div>
        </section>
        <div className="sticky bottom-3 z-10"><Submit className="btn-primary btn-lg w-full shadow-pop">ENREGISTRER LE PRODUIT</Submit></div>
      </div>
    </ActionForm>
  );
}
