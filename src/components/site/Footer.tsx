import Link from "next/link";
import { getSettings, whatsappUrl } from "@/lib/settings";
import { displayPhone, normalizePhone } from "@/lib/format";
import { Icon } from "../ui/Icon";
import { Logo } from "../ui/bits";

export async function Footer() {
  const s = await getSettings();
  const phone = displayPhone(normalizePhone(s.contact.phone) ?? s.contact.phone);
  return (
    <footer className="mt-16 bg-navy-950 pb-24 text-white lg:pb-0">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 md:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-4">
          <div className="inline-block rounded-2xl bg-white p-2"><Logo className="h-14 w-auto" src={s.brand.logo_url} /></div>
          <p className="max-w-xs text-sm text-white/70">{s.brand.slogan} {s.brand.tagline}.</p>
          <div className="flex gap-2 text-sm font-bold">
            {s.social.facebook && <a href={s.social.facebook} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" rel="noopener noreferrer" target="_blank">Facebook</a>}
            {s.social.instagram && <a href={s.social.instagram} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" rel="noopener noreferrer" target="_blank">Instagram</a>}
            {s.social.tiktok && <a href={s.social.tiktok} className="rounded-full bg-white/10 px-3 py-1.5 hover:bg-white/20" rel="noopener noreferrer" target="_blank">TikTok</a>}
          </div>
        </div>
        <div>
          <h3 className="h-display mb-4 text-xl text-electric-300">Nous contacter</h3>
          <ul className="space-y-3 text-sm text-white/80">
            <li className="flex gap-2.5"><Icon name="phone" size={18} className="mt-0.5 shrink-0 text-electric-300" /> <a href={`tel:+${normalizePhone(s.contact.phone)}`}>{phone}</a></li>
            <li className="flex gap-2.5"><Icon name="whatsapp" size={18} className="mt-0.5 shrink-0 text-electric-300" /> <a href={whatsappUrl(s)} target="_blank" rel="noopener">Commander sur WhatsApp</a></li>
            <li className="flex gap-2.5"><Icon name="pin" size={18} className="mt-0.5 shrink-0 text-electric-300" /> <span>{[s.contact.address, s.contact.city, s.contact.country].filter(Boolean).join(", ")}</span></li>
          </ul>
        </div>
        <div>
          <h3 className="h-display mb-4 text-xl text-electric-300">Horaires</h3>
          <ul className="space-y-1.5 text-sm text-white/80">
            {s.hours.map((h) => <li key={h.day} className="flex justify-between gap-4"><span>{h.day}</span><span className="font-semibold">{h.closed ? "Fermé" : `${h.open} – ${h.close}`}</span></li>)}
          </ul>
        </div>
        <div>
          <h3 className="h-display mb-4 text-xl text-electric-300">Liens utiles</h3>
          <ul className="grid gap-2 text-sm text-white/80">
            {[["/produits", "Tous nos produits"], ["/promotions", "Les bonnes affaires"], ["/livraison", "Livraison & zones"], ["/mon-espace/commandes", "Suivre ma commande"], ["/a-propos", "À propos"], ["/contact", "Contact"]].map(([h, l]) => <li key={h}><Link href={h} className="hover:text-white">{l}</Link></li>)}
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">© {new Date().getFullYear()} {s.brand.name} — Fraîcheur, Qualité, Confiance… Chaque jour pour vous !</div>
    </footer>
  );
}
