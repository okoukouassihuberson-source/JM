import type { Metadata } from "next";
import { changePasswordAction, logoutAction, updateProfileAction } from "@/actions/auth";
import { ActionForm, Submit } from "@/components/ui/ActionForm";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { requireUser } from "@/lib/auth";
import { displayPhone } from "@/lib/format";

export const metadata: Metadata = { title: "Mon profil" };

export default async function Profil() {
  const u = await requireUser("/mon-espace/profil");
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Mon profil</h1>
      <ActionForm action={updateProfileAction} className="card grid gap-4 p-5 sm:grid-cols-2">
        <div><label className="label">Prénom</label><input name="first_name" defaultValue={u.first_name} required className="input" /></div>
        <div><label className="label">Nom</label><input name="last_name" defaultValue={u.last_name} required className="input" /></div>
        <div><label className="label">Téléphone (identifiant)</label><input value={displayPhone(u.phone)} disabled className="input bg-slate-50" /></div>
        <div><label className="label">E-mail (facultatif)</label><input name="email" type="email" defaultValue={u.profile_email ?? ""} className="input" /></div>
        <div className="sm:col-span-2"><Submit className="btn-primary">Enregistrer</Submit></div>
      </ActionForm>
      <ActionForm action={changePasswordAction} className="card space-y-4 p-5" reset>
        <h2 className="h-display text-2xl text-navy-900">Changer le mot de passe</h2>
        <div><label className="label">Mot de passe actuel</label><PasswordInput name="current" autoComplete="current-password" required /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="label">Nouveau</label><PasswordInput name="password" autoComplete="new-password" minLength={8} required /></div><div><label className="label">Confirmer</label><PasswordInput name="confirm" autoComplete="new-password" minLength={8} required /></div></div>
        <Submit className="btn-navy">Mettre à jour</Submit>
      </ActionForm>
      <form action={logoutAction}><button className="btn-outline">Se déconnecter</button></form>
    </div>
  );
}
