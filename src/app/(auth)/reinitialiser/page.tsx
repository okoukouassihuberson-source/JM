import type { Metadata } from "next";
import Link from "next/link";
import { resetPasswordAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { PasswordInput } from "@/components/ui/PasswordInput";

export const metadata: Metadata = { title: "Nouveau mot de passe", robots: { index: false } };

export default function Reset() {
  return (
    <>
      <h1 className="h-display text-4xl text-navy-900">Nouveau mot de passe</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Saisissez le code reçu de JM Poissonnerie (valable 1 heure, à usage unique).</p>
      <ActionForm action={resetPasswordAction} className="space-y-4">
        <div><label className="label" htmlFor="phone">Numéro de téléphone</label><input id="phone" name="phone" inputMode="tel" required className="input" /></div>
        <div><label className="label" htmlFor="code">Code à 6 chiffres</label><input id="code" name="code" inputMode="numeric" pattern="\d{6}" maxLength={6} required className="input text-center text-2xl font-black tracking-[0.5em]" autoComplete="one-time-code" /></div>
        <div><label className="label" htmlFor="password">Nouveau mot de passe</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required /></div>
        <div><label className="label" htmlFor="confirm">Confirmer</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required /></div>
        <Submit className="btn-primary btn-lg w-full">ENREGISTRER</Submit>
      </ActionForm>
      <p className="mt-5 text-center text-sm"><Link href="/connexion" className="font-bold text-electric-500">Retour à la connexion</Link></p>
    </>
  );
}
