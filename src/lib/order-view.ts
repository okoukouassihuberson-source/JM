import { one, query } from "@/db";

export async function getOrderDetail(number: string, userId?: string) {
  const order = await one<any>("select * from orders where number = $1 and ($2::uuid is null or user_id = $2)", [number, userId ?? null]);
  if (!order) return null;
  const [items, payment, delivery, history, invoice, customer] = await Promise.all([
    query<any>("select oi.*, p.slug from order_items oi left join products p on p.id = oi.product_id where oi.order_id = $1 order by oi.name", [order.id]),
    one<any>("select * from payments where order_id = $1 order by created_at desc limit 1", [order.id]),
    one<any>(
      `select d.*, dr.id as driver_row_id, dr.vehicle, du.first_name as driver_first, du.last_name as driver_last, du.phone as driver_phone
         from deliveries d left join drivers dr on dr.id = d.driver_id left join users du on du.id = dr.user_id where d.order_id = $1`, [order.id]),
    query<any>("select h.*, u.first_name, u.last_name from delivery_status_history h left join users u on u.id = h.actor_id where h.order_id = $1 order by h.created_at, h.id", [order.id]),
    one<any>("select number, issued_at from invoices where order_id = $1", [order.id]),
    one<any>("select first_name, last_name, phone from users where id = $1", [order.user_id]),
  ]);
  return { order, items, payment, delivery, history, invoice, customer };
}
export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;
