import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center bg-navy-950 px-4 text-center text-white">
      <div><Icon name="fish" size={64} className="mx-auto text-electric-400" /><h1 className="h-display mt-4 text-7xl">404</h1><p className="mt-2 text-white/70">Ce poisson a filé… la page est introuvable.</p><Link href="/" className="btn-primary mt-6">Retour à l&apos;accueil</Link></div>
    </div>
  );
}
