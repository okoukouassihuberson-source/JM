import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Empty } from "@/components/ui/bits";
import { one } from "@/db";
import { requireUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Suivre ma commande" };

export default async function Suivi() {
  const u = await requireUser("/mon-espace/suivi");
  const o = await one<{ number: string }>("select number from orders where user_id = $1 and status not in ('delivered','cancelled') order by created_at desc limit 1", [u.id])
    ?? await one<{ number: string }>("select number from orders where user_id = $1 order by created_at desc limit 1", [u.id]);
  if (o) redirect(`/mon-espace/commandes/${o.number}`);
  return <Empty icon="truck" title="Aucune commande à suivre" text="Passez votre première commande pour suivre sa livraison ici." href="/produits" cta="Commander" />;
}
