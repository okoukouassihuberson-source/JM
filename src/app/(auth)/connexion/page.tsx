import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { getUser, landingFor, safeNext } from "@/lib/auth";

export const metadata: Metadata = { title: "Connexion", robots: { index: false } };

export default async function Connexion({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const sp = await searchParams;
  const u = await getUser();
  if (u) redirect(safeNext(sp.next) ?? landingFor(u));
  return (
    <>
      <h1 className="h-display text-4xl text-navy-900">Connexion</h1>
      <p className="mb-5 mt-1 text-sm text-muted">Accédez à vos commandes et au suivi de livraison.</p>
      {sp.reset && <p className="mb-4 rounded-xl bg-success-50 px-3.5 py-3 text-sm font-semibold text-success-600">Mot de passe modifié. Connectez-vous avec le nouveau.</p>}
      <ActionForm action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={sp.next ?? ""} />
        <div><label className="label" htmlFor="phone">Numéro de téléphone</label><input id="phone" name="phone" inputMode="tel" autoComplete="username" placeholder="07 10 36 99 75" required className="input" /></div>
        <div><label className="label" htmlFor="password">Mot de passe</label><PasswordInput id="password" name="password" autoComplete="current-password" required /></div>
        <Submit className="btn-primary btn-lg w-full" pendingText="Connexion…">SE CONNECTER</Submit>
      </ActionForm>
      <div className="mt-5 flex flex-col items-center gap-2 text-sm">
        <Link href="/mot-de-passe-oublie" className="font-bold text-electric-500">Mot de passe oublié ?</Link>
        <p className="text-muted">Pas encore de compte ? <Link href={`/inscription${sp.next ? `?next=${encodeURIComponent(sp.next)}` : ""}`} className="font-bold text-electric-500">Créer un compte</Link></p>
      </div>
    </>
  );
}
