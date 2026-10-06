import { cache } from "react";
import { query } from "@/db";

export type DayHours = { day: string; open: string; close: string; closed: boolean };

export const DEFAULT_SETTINGS = {
  brand: {
    name: "JM POISSONNERIE",
    slogan: "La fraîcheur au service de votre table !",
    tagline: "Fraîcheur — Qualité — Confiance — Bon prix",
    logo_url: "/images/brand/logo.webp",
    hero_title: "La fraîcheur au service de votre table",
    hero_subtitle: "Des produits frais, sélectionnés avec soin, au meilleur rapport qualité-prix.",
  },
  contact: {
    phone: "0710369975",
    whatsapp: "2250710369975", // numéro WhatsApp (format international sans +) — modifiable : Paramètres → Contact
    whatsapp_message: "Bonjour JM Poissonnerie, je souhaite passer une commande.",
    email: "",
    address: "Quartier Begnery (Carreaux Cassé)",
    city: "",
    country: "Côte d'Ivoire",
    latitude: "",
    longitude: "",
  },
  hours: [
    { day: "Lundi", open: "07:00", close: "20:00", closed: false },
    { day: "Mardi", open: "07:00", close: "20:00", closed: false },
    { day: "Mercredi", open: "07:00", close: "20:00", closed: false },
    { day: "Jeudi", open: "07:00", close: "20:00", closed: false },
    { day: "Vendredi", open: "07:00", close: "20:00", closed: false },
    { day: "Samedi", open: "07:00", close: "20:00", closed: false },
    { day: "Dimanche", open: "08:00", close: "14:00", closed: false },
  ] as DayHours[],
  social: { facebook: "", instagram: "", tiktok: "" },
  delivery: {
    express_supplement: 1000, // FCFA ajoutés à la zone pour la livraison express
    free_delivery_threshold: 0, // 0 = désactivé
    min_order: 0,
    pickup_enabled: true,
    express_enabled: true,
    require_delivery_code: true,
    live_tracking_enabled: true, // GPS temps réel optionnel
  },
  payment: {
    cash_on_delivery: true,
    mobile_money_manual: true,
    mobile_money_numbers: "Orange Money : 07 10 36 99 75\nMTN MoMo : 05 00 00 00 00\nWave : 07 10 36 99 75",
    cinetpay: true, // actif seulement si les clés API sont présentes dans l'environnement
  },
  seo: {
    title: "JM Poissonnerie — Poisson frais, carpes, poulet, rognons, tripes & livraison",
    description:
      "Commandez en ligne du poisson frais, des carpes, du poulet, des rognons et des tripes. Livraison rapide, qualité garantie et meilleurs prix chez JM Poissonnerie.",
    keywords: "poissonnerie, poisson frais, carpe, poissonnerie livraison, poisson frais livraison, rognon, tripes, poulet",
  },
};

export type Settings = typeof DEFAULT_SETTINGS;
export type SettingKey = keyof Settings;

export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await query<{ key: SettingKey; value: any }>("select key, value from settings");
  const out: any = structuredClone(DEFAULT_SETTINGS);
  for (const r of rows) {
    out[r.key] = Array.isArray(out[r.key]) ? r.value : { ...out[r.key], ...r.value };
  }
  return out;
});

export async function saveSetting(key: SettingKey, value: unknown, userId: string) {
  await query(
    `insert into settings(key, value, updated_by, updated_at) values ($1, $2::jsonb, $3, now())
     on conflict (key) do update set value = excluded.value, updated_by = excluded.updated_by, updated_at = now()`,
    [key, JSON.stringify(value), userId],
  );
}

export const whatsappUrl = (s: Settings, msg?: string) =>
  `https://wa.me/${s.contact.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(msg ?? s.contact.whatsapp_message)}`;
