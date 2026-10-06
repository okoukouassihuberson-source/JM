import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getUser, landingFor } from "@/lib/auth";

export const metadata: Metadata = { title: "Créer un compte", robots: { index: false } };

export default async function Inscription({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const sp = await searchParams;
  const u = await getUser();
  if (u) redirect(landingFor(u));
  return (
    <>
      <h1 className="h-display text-4xl text-navy-900">Créer un compte</h1>
      <p className="mb-5 mt-1 text-sm text-muted">30 secondes, sans code de confirmation. Votre numéro sert d&apos;identifiant.</p>
      <ActionForm action={registerAction} className="space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="ln">Nom</label><input id="ln" name="last_name" autoComplete="family-name" required className="input" /></div>
          <div><label className="label" htmlFor="fn">Prénom</label><input id="fn" name="first_name" autoComplete="given-name" required className="input" /></div>
        </div>
        <div><label className="label" htmlFor="phone">Numéro de téléphone</label><input id="phone" name="phone" inputMode="tel" autoComplete="username" placeholder="07 10 36 99 75" required className="input" /></div>
        <div><label className="label" htmlFor="password">Mot de passe</label><PasswordInput id="password" name="password" autoComplete="new-password" minLength={8} required /><p className="mt-1 text-xs text-muted">8 caractères minimum.</p></div>
        <div><label className="label" htmlFor="confirm">Confirmer le mot de passe</label><PasswordInput id="confirm" name="confirm" autoComplete="new-password" minLength={8} required /></div>
        <Submit className="btn-primary btn-lg w-full" pendingText="Création…">CRÉER MON COMPTE</Submit>
      </ActionForm>
      <p className="mt-5 text-center text-sm text-muted">Déjà client ? <Link href={`/connexion${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-bold text-electric-500">Se connecter</Link></p>
    </>
  );
}
