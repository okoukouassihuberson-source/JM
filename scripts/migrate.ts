import "./env";
import { readdirSync, readFileSync } from "node:fs";
import { pool } from "../src/db";

async function main() {
  const p = pool();
  if (process.argv.includes("--reset")) {
    await p.query("drop schema public cascade; create schema public;");
    console.log("↺ schéma public réinitialisé");
  }
  await p.query("create table if not exists _migrations (name text primary key, applied_at timestamptz default now())");
  const done = new Set((await p.query("select name from _migrations")).rows.map((r) => r.name));
  for (const f of readdirSync("db/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    if (done.has(f)) continue;
    const c = await p.connect();
    try {
      await c.query("begin");
      await c.query(readFileSync(`db/migrations/${f}`, "utf8"));
      await c.query("insert into _migrations(name) values ($1)", [f]);
      await c.query("commit");
      console.log("✔ migration", f);
    } catch (e) {
      await c.query("rollback");
      throw e;
    } finally {
      c.release();
    }
  }
  await p.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
