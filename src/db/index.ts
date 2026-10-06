import { Pool, types, type PoolClient, type QueryResultRow } from "pg";

// numeric / bigint → number (montants FCFA et quantités tiennent largement dans un double)
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));

const g = globalThis as unknown as { __jmPool?: Pool };

export function pool(): Pool {
  if (!g.__jmPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL manquant (voir .env.example)");
    g.__jmPool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }
  return g.__jmPool;
}

type Q = Pick<PoolClient, "query">;

export async function query<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], c: Q = pool()): Promise<T[]> {
  return (await c.query<T>(sql, params as any[])).rows;
}

export async function one<T extends QueryResultRow = any>(sql: string, params: unknown[] = [], c: Q = pool()): Promise<T | null> {
  return (await query<T>(sql, params, c))[0] ?? null;
}

export type Tx = PoolClient;

/** Exécute `fn` dans une transaction (rollback automatique si exception). */
export async function tx<T>(fn: (c: Tx) => Promise<T>): Promise<T> {
  const c = await pool().connect();
  try {
    await c.query("begin");
    const r = await fn(c);
    await c.query("commit");
    return r;
  } catch (e) {
    await c.query("rollback").catch(() => {});
    throw e;
  } finally {
    c.release();
  }
}
