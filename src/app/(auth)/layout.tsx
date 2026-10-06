import Link from "next/link";
import { Bubbles } from "@/components/site/Sections";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/bits";

import { getSettings } from "@/lib/settings";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <div className="relative isolate grid min-h-dvh place-items-center overflow-hidden bg-[radial-gradient(120%_90%_at_70%_0%,#1745b8_0%,#0d2370_40%,#050d2e_100%)] px-4 py-8">
      <Bubbles />
      <div className="relative w-full max-w-md">
        <Link href="/" className="mx-auto mb-5 block w-fit rounded-2xl bg-white p-2 shadow-pop" aria-label="Retour à l'accueil"><Logo className="h-14 w-auto" priority src={s.brand.logo_url} /></Link>
        <div className="card p-6 shadow-pop sm:p-8">{children}</div>
        <p className="mt-5 text-center text-sm text-white/70"><Link href="/" className="inline-flex items-center gap-1 font-semibold hover:text-white"><Icon name="left" size={16} /> Retour au site</Link></p>
      </div>
    </div>
  );
}
