import { BottomNav } from "@/components/site/BottomNav";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";
import { Icon } from "@/components/ui/Icon";
import { cartCount } from "@/lib/cart";
import { getSettings, whatsappUrl } from "@/lib/settings";

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [count, s] = await Promise.all([cartCount(), getSettings()]);
  return (
    <>
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Aller au contenu</a>
      <Header />
      <main id="contenu" className="min-h-[60vh]">{children}</main>
      <Footer />
      <BottomNav count={count} />
      <a href={whatsappUrl(s)} target="_blank" rel="noopener" aria-label="Commander sur WhatsApp"
        className="fixed bottom-20 right-4 z-30 grid size-14 place-items-center rounded-full bg-[#25d366] text-white shadow-pop transition hover:scale-105 lg:bottom-6">
        <Icon name="whatsapp" size={30} />
      </a>
    </>
  );
}
