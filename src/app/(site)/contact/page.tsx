import type { Metadata } from "next";
import { Icon } from "@/components/ui/Icon";
import { displayPhone, normalizePhone } from "@/lib/format";
import { getSettings, whatsappUrl } from "@/lib/settings";

export const metadata: Metadata = { title: "Contact et horaires — JM Poissonnerie", description: "Contactez JM Poissonnerie par téléphone ou WhatsApp, trouvez notre adresse et nos horaires d'ouverture." };

export default async function Contact() {
  const s = await getSettings();
  const phone = normalizePhone(s.contact.phone);
  const addr = [s.contact.address, s.contact.city, s.contact.country].filter(Boolean).join(", ");
  const map = s.contact.latitude && s.contact.longitude ? `https://www.openstreetmap.org/export/embed.html?bbox=${+s.contact.longitude - 0.006},${+s.contact.latitude - 0.004},${+s.contact.longitude + 0.006},${+s.contact.latitude + 0.004}&layer=mapnik&marker=${s.contact.latitude},${s.contact.longitude}` : null;
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <p className="mb-1 text-xs font-extrabold uppercase tracking-[0.2em] text-electric-500">Parlons-en</p>
      <h1 className="h-display text-5xl text-navy-900 sm:text-6xl">Contact</h1>
      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <div className="space-y-3">
          <a href={whatsappUrl(s)} target="_blank" rel="noopener" className="card flex items-center gap-4 border-[#25d366]/40 bg-[#25d366]/10 p-5 transition hover:shadow-pop"><span className="grid size-14 place-items-center rounded-full bg-[#25d366] text-white"><Icon name="whatsapp" size={28} /></span><span><b className="block text-lg text-navy-900">COMMANDER SUR WHATSAPP</b><span className="text-sm text-muted">{displayPhone(normalizePhone(s.contact.whatsapp) ?? s.contact.whatsapp)} — réponse rapide</span></span></a>
          <a href={`tel:+${phone}`} className="card flex items-center gap-4 p-5 transition hover:shadow-pop"><span className="grid size-14 place-items-center rounded-full bg-navy-900 text-white"><Icon name="phone" size={26} /></span><span><b className="block text-lg text-navy-900">{displayPhone(phone ?? s.contact.phone)}</b><span className="text-sm text-muted">Appelez-nous</span></span></a>
          <div className="card flex items-start gap-4 p-5"><span className="grid size-14 shrink-0 place-items-center rounded-full bg-electric-100 text-electric-500"><Icon name="pin" size={26} /></span><span><b className="block text-lg text-navy-900">Notre adresse</b><span className="text-sm text-muted">{addr}</span></span></div>
          {s.contact.email && <p className="text-sm text-muted">E-mail : <a className="font-bold text-electric-500" href={`mailto:${s.contact.email}`}>{s.contact.email}</a></p>}
        </div>
        <div className="space-y-4">
          <div className="card p-5"><h2 className="h-display mb-3 text-2xl text-navy-900">Horaires</h2><ul className="divide-y divide-line text-sm">{s.hours.map((h) => <li key={h.day} className="flex justify-between py-2"><span className="font-semibold">{h.day}</span><span>{h.closed ? "Fermé" : `${h.open} – ${h.close}`}</span></li>)}</ul></div>
          {map && <iframe title="Carte" loading="lazy" src={map} className="h-64 w-full rounded-2xl border border-line" />}
        </div>
      </div>
    </div>
  );
}
