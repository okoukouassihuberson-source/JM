import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
const MAX_BYTES = 6 * 1024 * 1024;

export class UploadError extends Error {}

// Supabase Storage (recommandé en production sur Vercel : le disque y est éphémère).
// Actif si SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY sont définis ; sinon stockage sur disque (UPLOAD_DIR).
const storage = () => {
  const url = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  return url && key ? { url, key, bucket: process.env.SUPABASE_BUCKET || "jm-media" } : null;
};

async function uploadToSupabase(st: NonNullable<ReturnType<typeof storage>>, objectPath: string, body: Buffer) {
  const headers = { Authorization: `Bearer ${st.key}`, apikey: st.key };
  const put = () => fetch(`${st.url}/storage/v1/object/${st.bucket}/${objectPath}`, {
    method: "POST", headers: { ...headers, "Content-Type": "image/webp", "Cache-Control": "max-age=31536000" }, body: new Uint8Array(body),
  });
  let r = await put();
  if (r.status === 404 || r.status === 400) {
    // Bucket absent : on le crée (public, WebP uniquement) puis on réessaie une fois.
    const c = await fetch(`${st.url}/storage/v1/bucket`, {
      method: "POST", headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ id: st.bucket, name: st.bucket, public: true, file_size_limit: MAX_BYTES, allowed_mime_types: ["image/webp"] }),
    });
    if (c.ok || c.status === 409) r = await put();
  }
  if (!r.ok) {
    console.error("Supabase Storage:", r.status, await r.text().catch(() => ""));
    throw new UploadError("Envoi de l'image impossible (stockage indisponible). Réessayez.");
  }
  return `${st.url}/storage/v1/object/public/${st.bucket}/${objectPath}`;
}

function sniff(b: Buffer): "jpeg" | "png" | "webp" | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpeg";
  if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

/**
 * Valide (taille + signature binaire réelle, pas l'extension) puis ré-encode l'image en WebP :
 * supprime EXIF/métadonnées et neutralise tout contenu non-image caché. Retourne l'URL publique.
 */
export async function saveImage(file: File, maxWidth = 1600): Promise<string> {
  if (!file || file.size === 0) throw new UploadError("Aucun fichier reçu.");
  if (file.size > MAX_BYTES) throw new UploadError("Image trop lourde (6 Mo maximum).");
  const buf = Buffer.from(await file.arrayBuffer());
  if (!sniff(buf)) throw new UploadError("Format non supporté (JPEG, PNG ou WebP uniquement).");
  let out: Buffer;
  try {
    out = await sharp(buf, { limitInputPixels: 40_000_000 }).rotate().resize({ width: maxWidth, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();
  } catch {
    throw new UploadError("Image illisible ou corrompue.");
  }
  const sub = new Date().toISOString().slice(0, 7);
  const name = `${randomUUID()}.webp`;
  const st = storage();
  if (st) return uploadToSupabase(st, `${sub}/${name}`, out);
  await mkdir(path.join(/* turbopackIgnore: true */ uploadDir(), sub), { recursive: true });
  await writeFile(path.join(/* turbopackIgnore: true */ uploadDir(), sub, name), out);
  return `/api/media/${sub}/${name}`;
}

export async function saveImages(files: File[], max = 6): Promise<string[]> {
  const real = files.filter((f) => f && f.size > 0).slice(0, max);
  const urls: string[] = [];
  for (const f of real) urls.push(await saveImage(f));
  return urls;
}
