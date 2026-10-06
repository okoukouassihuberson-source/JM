import { query, one } from "@/db";

const TZ = "Africa/Abidjan";
// CA = commandes non annulées (les échecs de livraison restent comptés tant qu'ils ne sont pas annulés).
const REV = "o.status <> 'cancelled'";

export async function dashboardStats() {
  const [rev] = await query<any>(
    `select
       coalesce(sum(total) filter (where (created_at at time zone '${TZ}')::date = (now() at time zone '${TZ}')::date), 0) as today,
       coalesce(sum(total) filter (where date_trunc('week', created_at at time zone '${TZ}') = date_trunc('week', now() at time zone '${TZ}')), 0) as week,
       coalesce(sum(total) filter (where date_trunc('month', created_at at time zone '${TZ}') = date_trunc('month', now() at time zone '${TZ}')), 0) as month,
       count(*) filter (where (created_at at time zone '${TZ}')::date = (now() at time zone '${TZ}')::date) as orders_today
     from orders o where ${REV}`);
  const statuses = await query<{ status: string; n: number }>("select status, count(*) n from orders group by status");
  const daily = await query<{ day: string; revenue: number; orders: number }>(
    `select to_char(d, 'YYYY-MM-DD') as day, coalesce(sum(o.total), 0)::int as revenue, count(o.id)::int as orders
       from generate_series((now() at time zone '${TZ}')::date - 13, (now() at time zone '${TZ}')::date, '1 day') d
       left join orders o on (o.created_at at time zone '${TZ}')::date = d::date and ${REV}
      group by d order by d`);
  const topProducts = await query<{ name: string; qty: number; revenue: number; unit_label: string }>(
    `select oi.name, sum(oi.quantity)::float qty, sum(oi.line_total)::int revenue, max(oi.unit_label) unit_label
       from order_items oi join orders o on o.id = oi.order_id where ${REV} group by oi.name order by revenue desc limit 6`);
  const topCategories = await query<{ name: string; revenue: number }>(
    `select c.name, sum(oi.line_total)::int revenue from order_items oi join orders o on o.id = oi.order_id
       join products p on p.id = oi.product_id join categories c on c.id = p.category_id where ${REV} group by c.name order by revenue desc`);
  const lowStock = await query<any>(
    `select p.id, p.name, p.unit_label, i.on_hand - i.reserved as available, i.alert_threshold
       from inventory i join products p on p.id = i.product_id
      where p.active and i.on_hand - i.reserved <= i.alert_threshold order by (i.on_hand - i.reserved)`);
  const delivery = await one<any>(
    `select count(*) filter (where status = 'delivered') delivered, count(*) filter (where status = 'failed') failed,
            coalesce(round(avg(extract(epoch from (delivered_at - assigned_at)) / 60) filter (where status = 'delivered')), 0)::int avg_minutes
       from deliveries`);
  const recent = await query<any>("select number, customer_name, total, status, created_at from orders order by created_at desc limit 6");
  return { rev, statuses: Object.fromEntries(statuses.map((s) => [s.status, s.n])) as Record<string, number>, daily, topProducts, topCategories, lowStock, delivery, recent };
}

export async function customerStats(userId: string) {
  return (await one<any>(
    `select count(*) filter (where status not in ('delivered','cancelled')) as in_progress,
            count(*) filter (where status = 'delivered') as delivered,
            coalesce(sum(total) filter (where status = 'delivered'), 0) as spent
       from orders where user_id = $1`, [userId]))!;
}
