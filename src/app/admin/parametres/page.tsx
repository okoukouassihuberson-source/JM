import type { Metadata } from "next";
import Image from "next/image";
import { saveSettingsAction } from "@/actions/admin-ops";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { requirePage } from "@/lib/auth";
import { displayPhone } from "@/lib/format";
import { cinetpayConfigured } from "@/lib/payments/cinetpay";
import { getSettings, type SettingKey } from "@/lib/settings";

export const metadata: Metadata = { title: "Paramètres" };

const Card = ({ id, title, hint, children }: { id: string; title: string; hint?: string; children: React.ReactNode }) => (
  <section id={id} className="card scroll-mt-20 space-y-4 p-5"><div><h2 className="h-display text-3xl text-navy-900">{title}</h2>{hint && <p className="text-sm text-muted">{hint}</p>}</div>{children}</section>
);
const Chk = ({ name, label, on }: { name: string; label: string; on: boolean }) => <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name={name} defaultChecked={on} className="size-5 accent-electric-500" /> {label}</label>;
const F = ({ label, name, v, type = "text", span = false, ...r }: any) => <div className={span ? "sm:col-span-2" : ""}><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} type={type} defaultValue={v} className="input" {...r} /></div>;

export default async function Settings() {
  await requirePage("settings.manage", "/admin/parametres");
  const s = await getSettings();
  const form = (g: SettingKey) => saveSettingsAction.bind(null, g);
  const tabs = [["contact", "Contact & WhatsApp"], ["brand", "Marque & logo"], ["hours", "Horaires"], ["delivery", "Livraison"], ["payment", "Paiement"], ["social", "Réseaux"], ["seo", "SEO"]];
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Paramètres</h1>
      <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">{tabs.map(([k, l]) => <a key={k} href={`#${k}`} className="btn-outline btn-sm shrink-0">{l}</a>)}</nav>

      <Card id="contact" title="Contact" hint="Paramètres → Contact : ces valeurs alimentent tout le site (en-tête, pied de page, boutons WhatsApp, factures, SEO local).">
        <ActionForm action={form("contact")} className="grid gap-4 sm:grid-cols-2">
          <F label="Téléphone affiché" name="phone" v={s.contact.phone} required />
          <F label="Numéro WhatsApp (international)" name="whatsapp" v={s.contact.whatsapp} required placeholder="2250710369975" />
          <F span label="Message WhatsApp pré-rempli" name="whatsapp_message" v={s.contact.whatsapp_message} maxLength={200} />
          <F label="E-mail" name="email" v={s.contact.email} type="email" />
          <F label="Adresse" name="address" v={s.contact.address} required />
          <F label="Ville (SEO local)" name="city" v={s.contact.city} placeholder="Ex : Abidjan" />
          <F label="Pays" name="country" v={s.contact.country} />
          <F label="Latitude (carte, facultatif)" name="latitude" v={s.contact.latitude} placeholder="5.3600" />
          <F label="Longitude (carte, facultatif)" name="longitude" v={s.contact.longitude} placeholder="-4.0083" />
          <div className="sm:col-span-2"><Submit className="btn-primary">Enregistrer</Submit></div>
        </ActionForm>
        <p className="text-xs text-muted">WhatsApp actuel : {displayPhone(s.contact.whatsapp)}</p>
      </Card>

      <Card id="brand" title="Marque & logo">
        <ActionForm action={form("brand")} className="grid gap-4 sm:grid-cols-2">
          <F label="Nom commercial" name="name" v={s.brand.name} required />
          <F label="Slogan" name="slogan" v={s.brand.slogan} />
          <F label="Promesse (footer)" name="tagline" v={s.brand.tagline} />
          <F label="Titre de la page d'accueil" name="hero_title" v={s.brand.hero_title} />
          <F span label="Sous-titre de la page d'accueil" name="hero_subtitle" v={s.brand.hero_subtitle} />
          <div className="flex items-center gap-4 sm:col-span-2"><Image src={s.brand.logo_url} alt="Logo actuel" width={160} height={64} className="h-16 w-auto rounded-xl border border-line bg-white p-1" />
            <div className="flex-1"><label className="label">Remplacer le logo</label><input type="file" name="logo" accept="image/jpeg,image/png,image/webp" className="input !py-2 text-sm" /></div></div>
          <div className="sm:col-span-2"><Submit className="btn-primary">Enregistrer</Submit></div>
        </ActionForm>
      </Card>

      <Card id="hours" title="Horaires d'ouverture">
        <ActionForm action={form("hours")} className="space-y-2">
          {s.hours.map((h, i) => (
            <div key={h.day} className="grid grid-cols-[90px_1fr_1fr_auto] items-center gap-2"><span className="text-sm font-bold">{h.day}</span><input type="time" name={`open${i}`} defaultValue={h.open} className="input" /><input type="time" name={`close${i}`} defaultValue={h.close} className="input" /><label className="flex items-center gap-1.5 text-xs font-semibold"><input type="checkbox" name={`closed${i}`} defaultChecked={h.closed} className="size-4 accent-promo-600" />Fermé</label></div>))}
          <Submit className="btn-primary mt-2">Enregistrer</Submit>
        </ActionForm>
      </Card>

      <Card id="delivery" title="Livraison" hint="Les tarifs et délais par zone se règlent dans « Zones de livraison ».">
        <ActionForm action={form("delivery")} className="grid gap-4 sm:grid-cols-2">
          <F label="Supplément express (FCFA)" name="express_supplement" v={s.delivery.express_supplement} type="number" min={0} />
          <F label="Livraison offerte dès (FCFA, 0 = jamais)" name="free_delivery_threshold" v={s.delivery.free_delivery_threshold} type="number" min={0} />
          <F label="Commande minimale (FCFA)" name="min_order" v={s.delivery.min_order} type="number" min={0} />
          <div className="grid gap-2 sm:col-span-2 sm:grid-cols-2"><Chk name="express_enabled" label="Livraison express disponible" on={s.delivery.express_enabled} /><Chk name="pickup_enabled" label="Retrait sur place disponible" on={s.delivery.pickup_enabled} />
            <Chk name="require_delivery_code" label="Exiger le code de livraison à la remise" on={s.delivery.require_delivery_code} /><Chk name="live_tracking_enabled" label="Suivi GPS en direct (optionnel côté client)" on={s.delivery.live_tracking_enabled} /></div>
          <div className="sm:col-span-2"><Submit className="btn-primary">Enregistrer</Submit></div>
        </ActionForm>
      </Card>

      <Card id="payment" title="Moyens de paiement" hint={cinetpayConfigured() ? "✅ Clés CinetPay détectées : le paiement en ligne peut être activé." : "Paiement en ligne : ajoutez CINETPAY_API_KEY et CINETPAY_SITE_ID dans les variables d'environnement (.env) puis redémarrez."}>
        <ActionForm action={form("payment")} className="grid gap-4">
          <div className="grid gap-2 sm:grid-cols-3"><Chk name="cash_on_delivery" label="Paiement à la livraison" on={s.payment.cash_on_delivery} /><Chk name="mobile_money_manual" label="Mobile Money (manuel)" on={s.payment.mobile_money_manual} /><Chk name="cinetpay" label="Paiement en ligne (CinetPay)" on={s.payment.cinetpay} /></div>
          <div><label className="label" htmlFor="mmn">Numéros Mobile Money (affichés au client)</label><textarea id="mmn" name="mobile_money_numbers" rows={4} defaultValue={s.payment.mobile_money_numbers} className="input" maxLength={400} /></div>
          <div><Submit className="btn-primary">Enregistrer</Submit></div>
        </ActionForm>
      </Card>

      <Card id="social" title="Réseaux sociaux">
        <ActionForm action={form("social")} className="grid gap-4 sm:grid-cols-3"><F label="Facebook (URL)" name="facebook" v={s.social.facebook} type="url" /><F label="Instagram (URL)" name="instagram" v={s.social.instagram} type="url" /><F label="TikTok (URL)" name="tiktok" v={s.social.tiktok} type="url" /><div className="sm:col-span-3"><Submit className="btn-primary">Enregistrer</Submit></div></ActionForm>
      </Card>

      <Card id="seo" title="Référencement (SEO)" hint="Titre et description de la page d'accueil. Astuce : renseignez la ville dans Contact pour le référencement local.">
        <ActionForm action={form("seo")} className="grid gap-4"><F label="Titre" name="title" v={s.seo.title} maxLength={120} /><div><label className="label">Description</label><textarea name="description" rows={3} defaultValue={s.seo.description} maxLength={300} className="input" /></div><F label="Mots-clés (séparés par des virgules)" name="keywords" v={s.seo.keywords} /><div><Submit className="btn-primary">Enregistrer</Submit></div></ActionForm>
      </Card>
    </div>
  );
}
