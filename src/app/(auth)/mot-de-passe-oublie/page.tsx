import type { Metadata } from "next";
import Link from "next/link";
import { forgotPasswordAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { getSettings, whatsappUrl } from "@/lib/settings";

export const metadata: Metadata = { title: "Mot de passe oublié", robots: { index: false } };

export default async function Forgot() {
  const s = await getSettings();
  return (
    <>
      <h1 className="h-display text-4xl text-navy-900">Mot de passe oublié</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Indiquez votre numéro : JM Poissonnerie vous remettra un code de réinitialisation à 6 chiffres (par téléphone ou WhatsApp).</p>
      <ActionForm action={forgotPasswordAction} className="space-y-4">
        <div><label className="label" htmlFor="phone">Numéro de téléphone</label><input id="phone" name="phone" inputMode="tel" required className="input" placeholder="07 10 36 99 75" /></div>
        <Submit className="btn-primary btn-lg w-full">DEMANDER UN CODE</Submit>
      </ActionForm>
      <div className="mt-5 space-y-2 text-center text-sm">
        <Link href="/reinitialiser" className="block font-bold text-electric-500">J&apos;ai déjà un code →</Link>
        <a href={whatsappUrl(s, "Bonjour, j'ai oublié mon mot de passe JM Poissonnerie.")} target="_blank" rel="noopener" className="block text-muted">Ou écrivez-nous sur WhatsApp</a>
        <Link href="/connexion" className="block text-muted">Retour à la connexion</Link>
      </div>
    </>
  );
}
