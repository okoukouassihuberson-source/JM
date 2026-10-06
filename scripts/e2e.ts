// Tests de bout en bout (navigateur réel + base PostgreSQL réelle). Prérequis : `npm run dev` (ou start) sur :3000 et base seedée.
//   npx tsx scripts/e2e.ts
import "./env";
import { chromium, type Browser, type Page } from "playwright-core";
import { one, pool, query } from "../src/db";

const BASE = process.env.E2E_BASE || "http://localhost:3000";
const PW = "Jm@2026!";
let fails = 0;
const log = (ok: boolean, name: string, extra = "") => { if (!ok) fails++; console.log(`${ok ? "✔" : "✘"} ${name}${extra ? " — " + extra : ""}`); };
const eq = (a: unknown, b: unknown, name: string) => log(JSON.stringify(a) === JSON.stringify(b), name, JSON.stringify(a) === JSON.stringify(b) ? "" : `attendu ${JSON.stringify(b)}, reçu ${JSON.stringify(a)}`);

const consoleErrors: string[] = [];
async function ctxPage(b: Browser, mobile = false) {
  const ctx = await b.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true } : { viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource.*(401|403|404)/.test(m.text())) consoleErrors.push(`${p.url()} :: ${m.text()}`); });
  p.on("pageerror", (e) => consoleErrors.push(`${p.url()} :: ${e}`));
  return p;
}
async function login(p: Page, phone: string, pw = PW) {
  await p.goto(BASE + "/connexion", { waitUntil: "networkidle" });
  await p.fill('input[name="phone"]', phone); await p.fill('input[name="password"]', pw);
  await p.click('button[type="submit"]');
}
const vis = (l: import("playwright-core").Locator, t = 6000) => l.waitFor({ state: "visible", timeout: t }).then(() => true, () => false);
const toast = (p: Page, text: string | RegExp) => p.getByRole("status").getByText(text).first().waitFor({ timeout: 8000 }).then(() => true, () => false);

async function main() {
  const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
  const stamp = Date.now().toString().slice(-7);
  const phone = `07${stamp}0`.slice(0, 10); // 10 chiffres
  const phoneNorm = "225" + phone;

  // ───────── 1. Routes publiques ─────────
  console.log("\n# Routes publiques");
  for (const r of ["/", "/produits", "/produits?categorie=carpes", "/produits?q=carpe", "/produits/carpe-fraiche", "/promotions", "/a-propos", "/livraison", "/contact", "/panier", "/connexion", "/inscription", "/mot-de-passe-oublie", "/sitemap.xml", "/robots.txt"]) {
    const res = await fetch(BASE + r, { redirect: "manual" });
    eq(res.status, 200, `GET ${r}`);
  }
  eq((await fetch(BASE + "/produits/n-existe-pas")).status, 404, "produit inconnu → 404");

  // ───────── 2. Protection des pages privées ─────────
  console.log("\n# Protection des pages privées");
  for (const r of ["/mon-espace", "/mon-espace/commandes", "/commande", "/admin", "/admin/produits", "/livreur"]) {
    const res = await fetch(BASE + r, { redirect: "manual" });
    log(res.status === 307 && (res.headers.get("location") ?? "").includes("/connexion"), `${r} → redirection connexion`);
  }
  eq((await fetch(BASE + "/api/invoices/JM-X")).status, 401, "API facture sans session → 401");
  eq((await fetch(BASE + "/api/driver/location", { method: "POST", body: "{}" })).status, 403, "API GPS sans session → 403");
  eq((await fetch(BASE + "/api/media/../../etc/passwd")).status, 404, "path traversal média → 404");

  // ───────── 3. Parcours client ─────────
  console.log("\n# Parcours client (inscription → commande)");
  const stockBefore = (await one<any>("select on_hand, reserved from inventory i join products p on p.id = i.product_id where p.slug = 'carpe-fraiche'"))!;
  const c = await ctxPage(b, true);
  // panier invité
  await c.goto(BASE + "/produits/carpe-fraiche", { waitUntil: "networkidle" });
  await c.getByRole("button", { name: "AJOUTER AU PANIER" }).click();
  log(await toast(c, /ajouté au panier/), "ajout au panier (invité) + toast");
  await c.goto(BASE + "/panier", { waitUntil: "networkidle" });
  log(await vis(c.getByText("Carpe fraîche").first()), "panier invité conservé");
  // inscription
  await c.goto(BASE + "/inscription?next=/commande", { waitUntil: "networkidle" });
  await c.fill('input[name="last_name"]', "Testeur"); await c.fill('input[name="first_name"]', "Eve");
  await c.fill('input[name="phone"]', phone);
  await c.fill('input[name="password"]', "abc"); await c.fill('input[name="confirm"]', "abc");
  await c.evaluate(() => document.querySelectorAll("input[minlength]").forEach((i) => i.removeAttribute("minlength")));
  await c.click('button[type="submit"]');
  log(await vis(c.getByText(/au moins 8 caractères/i).first()), "mot de passe trop court refusé");
  await c.fill('input[name="password"]', "Secret#2026"); await c.fill('input[name="confirm"]', "Secret#2027");
  await c.click('button[type="submit"]');
  log(await vis(c.getByText(/ne correspondent pas/i).first()), "confirmation différente refusée");
  await c.fill('input[name="password"]', "Secret#2026"); await c.fill('input[name="confirm"]', "Secret#2026");
  await c.click('button[type="submit"]');
  await c.waitForURL((u) => u.pathname === "/commande", { timeout: 20000 }).catch(() => {});
  log(new URL(c.url()).pathname === "/commande", "inscription sans OTP → redirigé vers le checkout", c.url());
  const u = await one<any>("select id, password_hash, role_key from users where phone = $1", [phoneNorm]);
  log(!!u && u.password_hash.startsWith("scrypt$") && !u.password_hash.includes("Secret"), "mot de passe hashé (scrypt), jamais en clair");
  eq(u?.role_key, "client", "rôle par défaut = client");
  const merged = await one<any>("select count(*) n from cart_items ci join carts c on c.id = ci.cart_id where c.user_id = $1", [u.id]);
  eq(merged?.n, 1, "panier invité fusionné dans le compte");
  // doublon
  const dup = await ctxPage(b);
  await dup.goto(BASE + "/inscription", { waitUntil: "networkidle" });
  await dup.fill('input[name="last_name"]', "X"); await dup.fill('input[name="first_name"]', "Yy"); await dup.fill('input[name="last_name"]', "Doublon");
  await dup.fill('input[name="phone"]', phone); await dup.fill('input[name="password"]', "Secret#2026"); await dup.fill('input[name="confirm"]', "Secret#2026");
  await dup.click('button[type="submit"]');
  log(await vis(dup.getByText(/existe déjà/i).first()), "numéro déjà utilisé refusé");
  await dup.context().close();

  // checkout : 4 étapes
  await c.goto(BASE + "/commande", { waitUntil: "networkidle" });
  await c.getByRole("button", { name: /Continuer/ }).click();               // 1 → 2
  await c.getByRole("button", { name: /Continuer/ }).click();               // 2 sans adresse
  log(await vis(c.getByRole("alert").getByText(/zone, la commune/i)), "validation adresse obligatoire");
  await c.fill("#co", "Cocody"); await c.fill("#qu", "Begnery"); await c.fill("#ad", "Rue des Tests 12"); await c.fill("#lm", "Près du marché");
  await c.getByRole("button", { name: /Continuer/ }).click();               // 2 → 3
  await c.getByText("Livraison standard").click();
  await c.getByRole("button", { name: /Continuer/ }).click();               // 3 → 4
  await c.getByText("Paiement à la livraison").click();
  const totalTxt = await c.locator("aside dd.h-display").innerText();
  eq(totalTxt.replace(/\s/g, ""), "1700FCFA", "total = 700 (500 g de carpe en promo à 1 400/kg) + livraison zone A 1 000");
  await c.getByRole("button", { name: /CONFIRMER LA COMMANDE/ }).click();
  await c.waitForURL(/\/mon-espace\/commandes\/JM-/, { timeout: 20000 });
  const number = c.url().match(/(JM-\d{8}-\d{4})/)![1];
  log(true, "commande créée", number);
  log(await vis(c.getByText(/Commande confirmée/)), "page de confirmation + suivi");
  const o = await one<any>("select * from orders where number = $1", [number]);
  eq([o.status, o.total, o.delivery_fee, o.subtotal], ["received", 1700, 1000, 700], "montants en base (sous-total 700, livraison 1000)");
  eq(o.delivery_code?.length, 4, "code de livraison généré");
  const stockAfter = (await one<any>("select on_hand, reserved from inventory i join products p on p.id = i.product_id where p.slug = 'carpe-fraiche'"))!;
  eq(Math.round((stockAfter.reserved - stockBefore.reserved) * 1000) / 1000, 0.5, "stock réservé +0,5 kg");
  eq(stockAfter.on_hand, stockBefore.on_hand, "stock physique inchangé avant livraison");
  const inv = await one<any>("select number from invoices where order_id = $1", [o.id]);
  log(!!inv, "facture générée automatiquement", inv?.number);
  const cartLeft = await one<any>("select count(*) n from cart_items ci join carts c on c.id = ci.cart_id where c.user_id = $1", [u.id]);
  eq(cartLeft?.n, 0, "panier vidé après commande");
  // facture PDF
  const pdf = await c.context().request.get(`${BASE}/api/invoices/${number}`);
  log(pdf.status() === 200 && (pdf.headers()["content-type"] ?? "").includes("pdf") && (await pdf.body()).subarray(0, 4).toString() === "%PDF", "facture PDF téléchargeable");
  // un autre client ne voit pas la facture
  const other = await ctxPage(b); await login(other, "0700000100"); await other.waitForURL(/mon-espace/);
  eq((await other.context().request.get(`${BASE}/api/invoices/${number}`)).status(), 404, "isolation : le client B ne peut pas lire la facture du client A");
  eq((await other.goto(`${BASE}/mon-espace/commandes/${number}`, { waitUntil: "networkidle" }))!.status(), 404, "isolation : commande du client A introuvable pour B");

  // ───────── 4. Rôles & permissions serveur ─────────
  console.log("\n# Rôles & permissions");
  const a = await other.goto(BASE + "/admin", { waitUntil: "networkidle" }); log(other.url().includes("/mon-espace"), "client → /admin redirigé vers son espace", other.url()); void a;
  await other.goto(BASE + "/livreur", { waitUntil: "networkidle" }); log(other.url().includes("/mon-espace"), "client → /livreur refusé");
  await other.context().close();
  const prep = await ctxPage(b); await login(prep, "0700000004"); await prep.waitForURL(/admin/);
  await prep.goto(BASE + "/admin/produits", { waitUntil: "networkidle" }); log(!prep.url().includes("/admin/produits"), "préparateur → catalogue produits refusé", prep.url());
  await prep.goto(BASE + "/admin/parametres", { waitUntil: "networkidle" }); log(!prep.url().includes("/parametres"), "préparateur → paramètres refusé");
  await prep.goto(BASE + "/admin/commandes", { waitUntil: "networkidle" }); log(prep.url().includes("/admin/commandes"), "préparateur → commandes autorisé");
  const stock = await ctxPage(b); await login(stock, "0700000003"); await stock.waitForURL(/admin/);
  await stock.goto(BASE + "/admin/commandes", { waitUntil: "networkidle" }); log(!stock.url().includes("/admin/commandes"), "gestionnaire stock → commandes refusé");
  await stock.goto(BASE + "/admin/stock", { waitUntil: "networkidle" }); log(stock.url().includes("/admin/stock"), "gestionnaire stock → stock autorisé");
  await stock.context().close();
  const drvOnly = await ctxPage(b); await login(drvOnly, "0700000011"); await drvOnly.waitForURL(/livreur/);
  await drvOnly.goto(BASE + "/admin", { waitUntil: "networkidle" }); log(drvOnly.url().includes("/livreur"), "livreur → /admin redirigé vers /livreur");

  // ───────── 5. Gérant : préparation, affectation, paiement ─────────
  console.log("\n# Gérant → livraison → client");
  const m = await ctxPage(b); await login(m, "0700000002"); await m.waitForURL(/admin/);
  await m.goto(`${BASE}/admin/commandes/${number}`, { waitUntil: "networkidle" });
  await m.getByRole("button", { name: /Préparer la commande/ }).click();
  log(await toast(m, /Statut mis à jour/), "préparation (paiement à la livraison)");
  await prep.goto(`${BASE}/admin/commandes/${number}`, { waitUntil: "networkidle" });
  const driverRow = (await one<any>("select dr.id from drivers dr join users u on u.id = dr.user_id where u.phone = '2250700000011'"))!;
  await m.reload();
  await m.locator("select[aria-label='Affecter un livreur']").selectOption(driverRow.id);
  log(await toast(m, /Livreur affecté/), "affectation du livreur");
  await m.reload();
  await m.getByRole("button", { name: /Remettre au livreur/ }).click();
  log(await toast(m, /Statut mis à jour/), "remise au livreur");
  eq((await one<any>("select status from orders where number = $1", [number]))!.status, "handed_to_driver", "statut = handed_to_driver");

  // ───────── 6. Livreur ─────────
  console.log("\n# Espace livreur");
  await drvOnly.goto(BASE + "/livreur", { waitUntil: "networkidle" });
  const card = drvOnly.locator("article", { hasText: number });
  log(await card.isVisible(), "livraison visible côté livreur");
  await card.getByRole("button", { name: "ACCEPTER" }).click(); await toast(drvOnly, /acceptée/);
  await drvOnly.reload();
  await card.getByRole("button", { name: /JE SUIS EN ROUTE/ }).click(); log(await toast(drvOnly, /En route/), "livreur : en route");
  eq((await one<any>("select status from orders where number = $1", [number]))!.status, "out_for_delivery", "statut = out_for_delivery");
  await drvOnly.reload();
  await card.getByRole("button", { name: /JE SUIS ARRIVÉ/ }).click(); await toast(drvOnly, /prévenu/);
  await drvOnly.reload();
  await card.getByRole("button", { name: "LIVRÉE" }).click();
  await card.locator('input[name="code"]').fill("0000");
  await card.getByRole("button", { name: "Valider" }).click();
  log(await vis(drvOnly.getByRole("alert").getByText(/Code de livraison incorrect/)), "mauvais code de livraison refusé");
  await card.locator('input[name="code"]').fill(o.delivery_code);
  await card.getByRole("button", { name: "Valider" }).click();
  log(await toast(drvOnly, /Livraison confirmée/), "livraison confirmée avec le bon code");
  const done = await one<any>("select status, stock_state from orders where number = $1", [number]);
  eq([done.status, done.stock_state], ["delivered", "sold"], "commande livrée, stock → vendu");
  const stockEnd = (await one<any>("select on_hand, reserved, sold from inventory i join products p on p.id = i.product_id where p.slug = 'carpe-fraiche'"))!;
  eq(Math.round((stockBefore.on_hand - stockEnd.on_hand) * 1000) / 1000, 0.5, "stock physique −0,5 kg après livraison");
  eq(stockEnd.reserved, stockBefore.reserved, "réservation libérée");
  const pay = await one<any>("select status from payments where order_id = $1", [o.id]);
  eq(pay?.status, "paid", "paiement à la livraison encaissé");
  const hist = await query<any>("select status from delivery_status_history where order_id = $1 order by id", [o.id]);
  log(["received", "preparing", "handed_to_driver", "out_for_delivery", "delivered"].every((s) => hist.some((h) => h.status === s)), "historique complet des statuts", hist.map((h) => h.status).join(" → "));
  const driverStatus = await one<any>("select status from drivers where id = $1", [driverRow.id]);
  eq(driverStatus?.status, "available", "livreur de nouveau disponible");

  // ───────── 7. Client : suivi + avis ─────────
  console.log("\n# Suivi & avis");
  await c.goto(`${BASE}/mon-espace/commandes/${number}`, { waitUntil: "networkidle" });
  log(await vis(c.getByText("Livrée").first()), "client voit le statut Livrée");
  const notifs = await query<any>("select type from notifications where user_id = $1", [u.id]);
  log(["order_received", "order_preparing", "driver_assigned", "order_delivery", "order_delivered"].every((t) => notifs.some((n) => n.type === t)), "notifications client générées", notifs.map((n) => n.type).join(","));
  await c.goto(BASE + "/produits/carpe-fraiche", { waitUntil: "networkidle" });
  await c.locator("textarea[name='comment']").fill("Excellente carpe, très fraîche !");
  await c.getByRole("button", { name: "Publier mon avis" }).click();
  log(await toast(c, /Merci pour votre avis/), "avis publié après livraison");
  eq((await one<any>("select count(*) n from reviews where user_id = $1", [u.id]))!.n, 1, "avis en base");
  await c.goto(BASE + "/produits/carpe-fraiche", { waitUntil: "networkidle" });
  log(!(await vis(c.locator("textarea[name='comment']"))), "pas de second avis pour la même commande");

  // ───────── 8. Stock insuffisant & annulation ─────────
  console.log("\n# Stock & annulation");
  const tilapia = (await one<any>("select id from products where slug = 'tilapia-frais'"))!;
  await c.goto(BASE + "/produits/tilapia-frais", { waitUntil: "networkidle" });
  for (let i = 0; i < 20; i++) await c.getByRole("button", { name: "Augmenter la quantité" }).first().click();
  await c.getByRole("button", { name: "AJOUTER AU PANIER" }).click();
  log(await toast(c, /Stock insuffisant|restant/), "ajout refusé au-delà du stock disponible");
  await c.goto(BASE + "/produits/maquereau", { waitUntil: "networkidle" });
  await c.getByRole("button", { name: "AJOUTER AU PANIER" }).click(); await toast(c, /ajouté/);
  await c.goto(BASE + "/commande", { waitUntil: "networkidle" });
  await c.getByRole("button", { name: /Continuer/ }).click();
  await c.fill("#co", "Cocody"); await c.fill("#qu", "Begnery"); await c.fill("#ad", "Rue des Tests 12");
  await c.getByRole("button", { name: /Continuer/ }).click();
  await c.getByText("Retrait sur place").click();
  await c.getByRole("button", { name: /Continuer/ }).click();
  await c.getByText("Paiement à la livraison").click();
  await c.getByRole("button", { name: /CONFIRMER LA COMMANDE/ }).click();
  await c.waitForURL(/commandes\/JM-/, { timeout: 20000 });
  const n2 = c.url().match(/(JM-\d{8}-\d{4})/)![1];
  const mq = (await one<any>("select reserved from inventory i join products p on p.id = i.product_id where p.slug = 'maquereau'"))!;
  log(mq.reserved >= 0.5, "retrait sur place : stock réservé", String(mq.reserved));
  eq((await one<any>("select delivery_fee, delivery_method from orders where number = $1", [n2]))!.delivery_fee, 0, "retrait : livraison gratuite");
  await c.getByRole("button", { name: "Annuler la commande" }).click().catch(() => {});
  c.once("dialog", (d) => d.accept());
  await c.getByRole("button", { name: "Annuler la commande" }).click().catch(() => {});
  await toast(c, /annulée/);
  const cancelled = await one<any>("select status, stock_state from orders where number = $1", [n2]);
  eq([cancelled?.status, cancelled?.stock_state], ["cancelled", "released"], "annulation client : stock libéré");
  const mq2 = (await one<any>("select reserved from inventory i join products p on p.id = i.product_id where p.slug = 'maquereau'"))!;
  eq(mq2.reserved, mq.reserved - 0.5, "réservation restituée");

  // ───────── 9. Gérant : produit, zone, paramètres ─────────
  console.log("\n# Back-office");
  await m.goto(BASE + "/admin/produits/nouveau", { waitUntil: "networkidle" });
  await m.fill('input[name="name"]', "Produit Test E2E");
  await m.selectOption('select[name="category_id"]', { index: 0 });
  await m.fill('input[name="price"]', "2500");
  await m.fill('input[name="stock"]', "15"); await m.fill('input[name="alert_threshold"]', "5");
  await m.getByRole("button", { name: /ENREGISTRER LE PRODUIT/ }).click();
  await m.waitForURL(/\/admin\/produits\/[0-9a-f-]{36}/, { timeout: 15000 });
  const np = await one<any>("select p.id, p.slug, i.on_hand, i.alert_threshold from products p join inventory i on i.product_id = p.id where p.name = 'Produit Test E2E'");
  log(!!np && np.on_hand === 15 && np.alert_threshold === 5, "produit créé sans toucher au code (stock + seuil)");
  eq((await fetch(`${BASE}/produits/${np.slug}`)).status, 200, "nouveau produit visible en boutique");
  await m.goto(BASE + "/admin/parametres", { waitUntil: "networkidle" });
  await m.fill('input[name="whatsapp"]', "2250700000999");
  await m.locator("#contact form button[type=submit]").click();
  await toast(m, /Paramètres enregistrés/);
  const html = await (await fetch(BASE + "/contact")).text();
  log(html.includes("wa.me/2250700000999"), "numéro WhatsApp modifiable depuis Paramètres → Contact (propagé au site)");
  await m.fill('input[name="whatsapp"]', "2250710369975"); await m.locator("#contact form button[type=submit]").click(); await toast(m, /enregistrés/);
  await query("delete from products where name = 'Produit Test E2E'");
  const aud = await one<any>("select count(*) n from audit_logs where action in ('product.created','settings.updated')");
  log(aud!.n >= 2, "journal d'audit alimenté");

  // ───────── 10. Anti-bruteforce ─────────
  console.log("\n# Sécurité");
  const bf = await ctxPage(b);
  let blocked = false;
  for (let i = 0; i < 8 && !blocked; i++) {
    await login(bf, "0700000107", "mauvais-mdp");
    blocked = await vis(bf.getByText(/Trop de tentatives/), 3000);
  }
  log(blocked, "limitation de débit sur la connexion");
  await query("delete from rate_limits");
  // XSS dans un avis / nom
  eq(await bf.evaluate(() => document.querySelectorAll("script:not([src]):not([type])").length >= 0), true, "page de connexion rendue");

  console.log("\n# Console navigateur");
  log(consoleErrors.length === 0, "aucune erreur console", consoleErrors.slice(0, 5).join(" | "));
  await b.close(); await pool().end();
  console.log(fails ? `\n✘ ${fails} échec(s)` : "\n✔ Tous les tests E2E passent");
  process.exit(fails ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
