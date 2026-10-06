import { createHash, randomBytes, randomInt, scrypt, timingSafeEqual } from "node:crypto";
import { query } from "@/db";

const N = 16384, R = 8, P = 1, KEYLEN = 64;

function scryptAsync(pw: string, salt: Buffer, N_: number, r: number, p: number): Promise<Buffer> {
  return new Promise((res, rej) =>
    scrypt(pw, salt, KEYLEN, { N: N_, r, p, maxmem: 128 * N_ * r + 1024 * 1024 }, (e, k) => (e ? rej(e) : res(k))),
  );
}

/** Hash scrypt salé : `scrypt$N$r$p$salt$hash`. Les mots de passe ne sont JAMAIS stockés en clair. */
export async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(pw, salt, N, R, P);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt" || !hash) return false;
  const key = await scryptAsync(pw, Buffer.from(salt, "base64"), +n, +r, +p);
  const expected = Buffer.from(hash, "base64");
  return key.length === expected.length && timingSafeEqual(key, expected);
}

// Hash factice pour égaliser le temps de réponse quand le compte n'existe pas (anti-énumération).
let dummy: Promise<string> | null = null;
export async function dummyVerify(pw: string) {
  dummy ??= hashPassword("dummy-password-for-timing");
  await verifyPassword(pw, await dummy);
}

export const newToken = () => randomBytes(32).toString("base64url");
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
export const numericCode = (digits: number) => String(randomInt(0, 10 ** digits)).padStart(digits, "0");

/** Limiteur de débit persistant (compteur par fenêtre glissante simple). Retourne false si dépassé. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const rows = await query<{ count: number }>(
    `insert into rate_limits(key, count, window_start) values ($1, 1, now())
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2) then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2) then now() else rate_limits.window_start end
     returning count`,
    [key, windowSec],
  );
  return rows[0].count <= max;
}

export async function resetRateLimit(key: string) {
  await query("delete from rate_limits where key = $1", [key]);
}
