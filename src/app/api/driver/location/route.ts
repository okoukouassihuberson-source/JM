import { NextResponse } from "next/server";
import { z } from "zod";
import { can, getUser } from "@/lib/auth";
import { updateDriverLocation } from "@/lib/orders";
import { rateLimit } from "@/lib/security";

export async function POST(req: Request) {
  const u = await getUser();
  if (!u || !can(u, "driver.access")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const p = z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "bad_request" }, { status: 400 });
  if (!(await rateLimit(`gps:${u.id}`, 12, 60))) return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  await updateDriverLocation(u.id, p.data.lat, p.data.lng);
  return NextResponse.json({ ok: true });
}
