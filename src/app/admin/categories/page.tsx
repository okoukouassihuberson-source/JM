import type { Metadata } from "next";
import Image from "next/image";
import { deleteCategoryAction, saveCategoryAction } from "@/actions/admin-catalog";
import { ActionButton, ActionForm, Submit } from "@/components/ui/ActionForm";
import { Icon } from "@/components/ui/Icon";
import { Badge } from "@/components/ui/bits";
import { requirePage } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";

export const metadata: Metadata = { title: "Catégories" };

function CatForm({ c }: { c?: any }) {
  return (
    <ActionForm action={saveCategoryAction.bind(null, c?.id ?? null)} className="grid gap-3 sm:grid-cols-2" reset={!c}>
      <div><label className="label">Nom</label><input name="name" defaultValue={c?.name} required className="input" /></div>
      <div><label className="label">Ordre d&apos;affichage</label><input name="sort_order" type="number" min={0} defaultValue={c?.sort_order ?? 0} className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Description courte</label><input name="description" defaultValue={c?.description} maxLength={300} className="input" /></div>
      <div className="sm:col-span-2"><label className="label">Image</label><input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="input !py-2 text-sm" /></div>
      <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="active" defaultChecked={c?.active ?? true} className="size-5 accent-electric-500" /> Visible en boutique</label>
      <div className="sm:text-right"><Submit className="btn-primary btn-sm">Enregistrer</Submit></div>
    </ActionForm>
  );
}

export default async function Categories() {
  await requirePage("categories.manage", "/admin/categories");
  const cats = await listCategories(true);
  const full = await (await import("@/db")).query<any>("select id, sort_order from categories");
  const order = new Map(full.map((c: any) => [c.id, c.sort_order]));
  return (
    <div className="space-y-5">
      <h1 className="h-display text-4xl text-navy-900 sm:text-5xl">Catégories</h1>
      <details className="card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 font-extrabold text-electric-500 [&::-webkit-details-marker]:hidden"><Icon name="plus" size={18} /> Nouvelle catégorie</summary><div className="mt-4"><CatForm /></div></details>
      <div className="grid gap-4 md:grid-cols-2">
        {cats.map((c) => (
          <article key={c.id} className="card space-y-3 p-4">
            <div className="flex gap-4"><span className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-electric-50">{c.image_url && <Image src={c.image_url} alt="" fill sizes="80px" className="object-cover" />}</span>
              <div className="min-w-0 flex-1"><h2 className="font-extrabold text-navy-900">{c.name} {!c.active && <Badge tone="gray">Masquée</Badge>}</h2><p className="line-clamp-2 text-sm text-muted">{c.description}</p><p className="mt-1 text-xs font-bold text-electric-500">{c.product_count} produit(s)</p></div>
              <ActionButton action={deleteCategoryAction} args={[c.id]} confirm={`Supprimer la catégorie « ${c.name} » ?`} className="btn-danger btn-sm h-fit"><Icon name="trash" size={14} /></ActionButton></div>
            <details><summary className="cursor-pointer text-sm font-bold text-electric-500">Modifier</summary><div className="mt-3"><CatForm c={{ ...c, sort_order: order.get(c.id) }} /></div></details>
          </article>))}
      </div>
    </div>
  );
}
