import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { uploadDir } from "@/lib/uploads";

/** Sert les images téléversées (WebP uniquement, chemin strictement validé contre le path traversal). */
export async function GET(_: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const parts = (await params).path;
  if (parts.length !== 2 || !/^\d{4}-\d{2}$/.test(parts[0]) || !/^[0-9a-f-]{36}\.webp$/.test(parts[1])) return new NextResponse("Not found", { status: 404 });
  try {
    const buf = await readFile(path.join(/* turbopackIgnore: true */ uploadDir(), parts[0], parts[1]));
    return new NextResponse(new Uint8Array(buf), { headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
