import { NextResponse } from "next/server";
import { query } from "@/db";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Léger (1 requête) : nombre de notifications non lues + celles arrivées depuis `since` (horodatage serveur). */
export async function GET(req: Request) {
  const u = await getUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const since = new URL(req.url).searchParams.get("since");
  const d = since && !Number.isNaN(Date.parse(since)) ? new Date(since) : null;
  const [{ unread, now }] = await query<{ unread: number; now: string }>(
    `select count(*)::int as unread, to_char(now() at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') as now from notifications where user_id = $1 and read_at is null`, [u.id]);
  const items = d
    ? await query("select id, title, body, link, created_at from notifications where user_id = $1 and read_at is null and created_at > $2 order by created_at desc limit 5", [u.id, d])
    : [];
  return NextResponse.json({ unread, now, items }, { headers: { "Cache-Control": "no-store" } });
}
