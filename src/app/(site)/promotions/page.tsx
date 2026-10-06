import type { Metadata } from "next";
import { PromoCard, SectionTitle } from "@/components/site/Sections";
import { Empty } from "@/components/ui/bits";
import { listProducts } from "@/lib/catalog";

export const metadata: Metadata = { title: "Les bonnes affaires — promotions poisson frais", description: "Promotions et offres limitées sur le poisson frais, les carpes, le poulet, les rognons et les tripes. Profitez-en vite chez JM Poissonnerie." };

export default async function Promotions() {
  const { items } = await listProducts({ promo: true, pageSize: 40 });
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <SectionTitle eyebrow="Offres limitées" title="Les bonnes affaires" />
      {items.length === 0 ? <Empty icon="percent" title="Aucune promotion en ce moment" text="Revenez bientôt ou suivez-nous sur WhatsApp pour ne rien manquer." href="/produits" cta="Voir les produits" /> : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 xl:grid-cols-4">{items.map((p, i) => <PromoCard key={p.id} p={p} index={i} />)}</div>
      )}
    </div>
  );
}
