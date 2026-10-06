import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || "./uploads");
const MAX_BYTES = 6 * 1024 * 1024;

export class UploadError extends Error {}

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
