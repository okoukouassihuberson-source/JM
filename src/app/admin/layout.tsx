import type { Metadata } from "next";
import { logoutAction } from "@/actions/auth";
import { AdminNav, type NavItem } from "@/components/admin/AdminNav";
import { one } from "@/db";
import { can, requireUser, landingFor } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { NotificationBell } from "@/components/NotificationBell";
import { OrderAlarm } from "@/components/admin/OrderAlarm";

const ALARM_TYPES = ["new_order", "payment_ref"];

export const metadata: Metadata = { title: { default: "Administration", template: "%s | OFROID Admin" }, robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const u = await requireUser("/admin");
  if (u.role_key === "client" || (u.role_key === "driver")) redirect(landingFor(u));
  const [pending, low, unread] = await Promise.all([
    can(u, "orders.view") ? one<{ n: number }>("select count(*) n from orders where status in ('received','payment_confirmed')") : null,
    can(u, "stock.view") ? one<{ n: number }>("select count(*) n from inventory i join products p on p.id = i.product_id where p.active and i.on_hand - i.reserved <= i.alert_threshold") : null,
    one<{ n: number }>("select count(*)::int n from notifications where user_id = $1 and read_at is null", [u.id]),
  ]);
  const all: (NavItem & { perm: string | string[] })[] = [
    { href: "/admin", label: "Tableau de bord", icon: "chart", perm: "dashboard.view" },
    { href: "/admin/commandes", label: "Commandes", icon: "package", perm: "orders.view", badge: pending?.n },
    { href: "/admin/produits", label: "Produits", icon: "fish", perm: "products.view" },
    { href: "/admin/categories", label: "Catégories", icon: "grid", perm: "categories.manage" },
    { href: "/admin/stock", label: "Stock", icon: "box", perm: "stock.view", badge: low?.n },
    { href: "/admin/livreurs", label: "Livreurs", icon: "truck", perm: "drivers.manage" },
    { href: "/admin/zones", label: "Zones de livraison", icon: "map", perm: "zones.manage" },
    { href: "/admin/promotions", label: "Promotions", icon: "percent", perm: "promotions.manage" },
    { href: "/admin/avis", label: "Avis clients", icon: "star", perm: "reviews.moderate" },
    { href: "/admin/clients", label: "Clients & équipe", icon: "users", perm: ["customers.view", "staff.manage"] },
    { href: "/admin/parametres", label: "Paramètres", icon: "settings", perm: "settings.manage" },
    { href: "/admin/journal", label: "Journal d'audit", icon: "file", perm: "audit.view" },
  ];
  const items = all.filter((i) => (Array.isArray(i.perm) ? i.perm : [i.perm]).some((p) => can(u, p)));
  return (
    <div className="min-h-dvh bg-ice lg:pl-64">
      <AdminNav items={items} user={{ name: `${u.first_name} ${u.last_name}`, role: u.role_label }} logout={logoutAction} />
      {/* Alerte en direct (son + message + rafraîchissement) à chaque nouvelle commande / versement, sans recharger la page. */}
      <div className="fixed right-[4.25rem] top-2 z-40 rounded-full bg-navy-900 text-white shadow-pop lg:right-6 lg:top-4"><NotificationBell initial={unread?.n ?? 0} href="/admin/commandes" seconds={8} alarmTypes={ALARM_TYPES} /></div>
      <OrderAlarm />
      <AutoRefresh seconds={20} />
      <main className="mx-auto max-w-[1400px] p-4 pb-16 lg:p-8">{children}</main>
    </div>
  );
}
