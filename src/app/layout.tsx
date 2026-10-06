import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { getSettings } from "@/lib/settings";
import { displayPhone, normalizePhone } from "@/lib/format";

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");

export async function generateMetadata(): Promise<Metadata> {
  const s = await getSettings();
  const where = [s.contact.city, s.contact.address].filter(Boolean).join(" — ");
  return {
    metadataBase: new URL(SITE),
    title: { default: s.seo.title, template: `%s | ${s.brand.name}` },
    description: s.seo.description,
    keywords: s.seo.keywords.split(",").map((k) => k.trim()),
    applicationName: s.brand.name,
    openGraph: { type: "website", locale: "fr_FR", siteName: s.brand.name, title: s.seo.title, description: `${s.seo.description}${where ? ` — ${where}` : ""}`, images: [{ url: "/images/brand/logo.jpg", width: 1280, height: 512, alt: s.brand.name }] },
    twitter: { card: "summary_large_image", title: s.seo.title, description: s.seo.description },
    alternates: { canonical: "/" },
    robots: { index: true, follow: true },
    icons: { icon: "/icon.png", apple: "/icon.png" },
  };
}

export const viewport: Viewport = { themeColor: "#0a1a52", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const phone = normalizePhone(s.contact.phone);
  const ld = {
    "@context": "https://schema.org",
    "@type": ["FishShop", "LocalBusiness"],
    name: s.brand.name,
    description: s.seo.description,
    url: SITE,
    image: `${SITE}/images/brand/logo.jpg`,
    telephone: phone ? `+${phone}` : s.contact.phone,
    priceRange: "FCFA",
    address: { "@type": "PostalAddress", streetAddress: s.contact.address, addressLocality: s.contact.city || undefined, addressCountry: s.contact.country },
    openingHoursSpecification: s.hours.filter((h) => !h.closed).map((h) => ({ "@type": "OpeningHoursSpecification", dayOfWeek: h.day, opens: h.open, closes: h.close })),
    sameAs: Object.values(s.social).filter(Boolean),
    areaServed: s.contact.city || s.contact.address,
  };
  return (
    <html lang="fr">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
        <ToastProvider>{children}</ToastProvider>
        <span className="sr-only">{displayPhone(phone ?? s.contact.phone)}</span>
      </body>
    </html>
  );
}
