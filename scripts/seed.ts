import "./env";
import { one, query, pool } from "../src/db";
import { hashPassword } from "../src/lib/security";
import { adjustStock } from "../src/lib/inventory";
import { tx } from "../src/db";
import { assignDriver, changeStatus, createOrder, driverAccept, type CheckoutInput } from "../src/lib/orders";
import { slugify } from "../src/lib/format";

const minimal = process.argv.includes("--minimal");
const PASSWORD = process.env.SEED_PASSWORD || "Jm@2026!";
const IMG = (n: string) => `/images/products/${n}.webp`;

const CATEGORIES = [
  { name: "Poissons", description: "Poissons frais du jour : tilapia, maquereau, vivaneau, capitaine…", image: "/images/categories/fruits-de-mer.webp" },
  { name: "Carpes", description: "Carpes fraîches, calibres au choix, prêtes à cuisiner.", image: IMG("carpe") },
  { name: "Poulet", description: "Poulet entier, cuisses, ailes : frais et sélectionnés.", image: IMG("poulet") },
  { name: "Rognons", description: "Rognons et abats frais, nettoyés avec soin.", image: IMG("rognon") },
  { name: "Tripes", description: "Tripes propres et fraîches, au kilo.", image: IMG("tripes") },
  { name: "Autres produits", description: "Tête de porc, crevettes, saumon, plateaux et plus encore.", image: IMG("tete-de-porc") },
];
const ZONES = [
  { name: "Zone A — Begnery & environs", description: "Quartier Begnery, Carreaux Cassé et alentours immédiats", fee: 1000, eta_min: 30, eta_max: 60 },
  { name: "Zone B — Quartiers proches", description: "Quartiers voisins (5 à 10 km)", fee: 1500, eta_min: 60, eta_max: 90 },
  { name: "Zone C — Périphérie", description: "Zones éloignées (selon disponibilité)", fee: 2500, eta_min: 90, eta_max: 150 },
];

async function user(phone: string, first: string, last: string, role: string) {
  const r = await one<{ id: string }>(
    `insert into users(phone, password_hash, role_key, first_name, last_name) values ($1,$2,$3,$4,$5)
     on conflict (phone) do update set role_key = excluded.role_key returning id`, [phone, await hashPassword(PASSWORD), role, first, last]);
  await query("insert into profiles(user_id) values ($1) on conflict do nothing", [r!.id]);
  return r!.id;
}

async function main() {
  const cat: Record<string, string> = {};
  for (const [i, c] of CATEGORIES.entries()) {
    cat[c.name] = (await one<{ id: string }>(
      `insert into categories(slug, name, description, image_url, sort_order) values ($1,$2,$3,$4,$5)
       on conflict (slug) do update set name = excluded.name returning id`, [slugify(c.name), c.name, c.description, c.image, i]))!.id;
  }
  for (const [i, z] of ZONES.entries())
    if (!(await one("select 1 from delivery_zones where name = $1", [z.name])))
      await query("insert into delivery_zones(name, description, fee, eta_min, eta_max, sort_order) values ($1,$2,$3,$4,$5,$6)", [z.name, z.description, z.fee, z.eta_min, z.eta_max, i]);

  if (minimal) {
    const phone = process.env.SEED_ADMIN_PHONE, pwd = process.env.SEED_ADMIN_PASSWORD;
    if (!phone || !pwd || pwd.length < 10) throw new Error("Mode --minimal : définir SEED_ADMIN_PHONE (ex 2250710369975) et SEED_ADMIN_PASSWORD (≥ 10 caractères).");
    await query(`insert into users(phone, password_hash, role_key, first_name, last_name) values ($1,$2,'super_admin','Admin','JM') on conflict (phone) do nothing`, [phone, await hashPassword(pwd)]);
    console.log("✔ base minimale prête (catégories, zones, super admin)");
    return pool().end();
  }

  // ───── Équipe ─────
  const staff = {
    admin: await user("2250700000001", "Awa", "Koné", "super_admin"),
    manager: await user("2250700000002", "Jean-Marc", "Yao", "manager"),
    stock: await user("2250700000003", "Fatou", "Traoré", "stock_manager"),
    prep: await user("2250700000004", "Serge", "Kouadio", "preparer"),
  };
  const driverDefs = [["2250700000011", "Ibrahim", "Diallo", "Moto"], ["2250700000012", "Yves", "N'Guessan", "Moto"], ["2250700000013", "Moussa", "Ouattara", "Tricycle"]];
  const drivers: { id: string; userId: string }[] = [];
  for (const [p, f, l, v] of driverDefs) {
    const uid = await user(p, f, l, "driver");
    const d = await one<{ id: string }>("insert into drivers(user_id, vehicle) values ($1,$2) on conflict (user_id) do update set vehicle = excluded.vehicle returning id", [uid, v]);
    drivers.push({ id: d!.id, userId: uid });
  }
  const clientDefs = [["Marie", "Koffi"], ["Aya", "Bamba"], ["Paul", "Séka"], ["Nadège", "Tano"], ["Kouassi", "Aka"], ["Salimata", "Coulibaly"], ["Eric", "Zadi"], ["Grâce", "Mensah"]];
  const clients: { id: string; name: string; phone: string }[] = [];
  for (const [i, [f, l]] of clientDefs.entries()) {
    const phone = `22507000001${String(i).padStart(2, "0")}`;
    clients.push({ id: await user(phone, f, l, "client"), name: `${f} ${l}`, phone });
  }

  // ───── Produits ─────
  type P = [string, string, "kg" | "piece" | "pack" | "tray", number, number, number, number, string, string, number?, [string, number][]?];
  // [nom, catégorie, unité, prix, stock dispo final, seuil, (réservé pour démo), image, description, prix promo, variantes]
  const PRODUCTS: P[] = [
    ["Carpe fraîche", "Carpes", "kg", 1700, 37, 10, 0, "carpe", "Carpes fraîches du jour, chair ferme et savoureuse. Idéales braisées, en sauce ou en court-bouillon. Écaillées et vidées sur demande.", 1400],
    ["Carpe grosse (calibre XL)", "Carpes", "kg", 1900, 22, 8, 0, "carpe", "Grosses carpes de plus de 1,5 kg pièce, parfaites pour les repas de famille et les grillades."],
    ["Carpe — pièce moyenne", "Carpes", "piece", 1500, 40, 10, 0, "carpe", "Carpe moyenne vendue à la pièce (environ 1 kg). Pratique pour un repas à 2 ou 3 personnes."],
    ["Tilapia frais", "Poissons", "kg", 2000, 8, 10, 0, "tilapia", "Tilapia entier très frais, conservé sur glace. Chair blanche et délicate."],
    ["Vivaneau rouge", "Poissons", "kg", 3500, 18, 6, 0, "vivaneau", "Vivaneau rouge entier, poisson noble à la chair fine. Parfait au four ou braisé."],
    ["Maquereau", "Poissons", "kg", 1600, 55, 15, 0, "maquereau", "Maquereau frais, riche en oméga-3, savoureux grillé ou fumé.", 1400],
    ["Capitaine", "Poissons", "kg", 3000, 14, 5, 0, "tilapia", "Capitaine frais en darnes ou entier, chair ferme sans arêtes fines."],
    ["Silure (machoiron)", "Poissons", "kg", 2200, 20, 8, 0, "tilapia", "Silure frais, idéal pour les sauces et les ragoûts."],
    ["Thon frais", "Poissons", "kg", 4000, 12, 5, 0, "maquereau", "Tranches de thon frais, à poêler ou à griller."],
    ["Sardines fraîches", "Poissons", "kg", 1200, 70, 20, 0, "poisson-mix", "Sardines fraîches, parfaites grillées ou en friture."],
    ["Plateau de poissons assortis", "Autres produits", "tray", 10000, 12, 4, 0, "poisson-mix", "Plateau garni de poissons frais assortis (environ 5 kg) pour les événements et les familles nombreuses."],
    ["Poulet de chair entier", "Poulet", "piece", 3500, 60, 15, 0, "poulet", "Poulet de chair entier, frais, prêt à cuisiner (environ 1,5 kg).", undefined, [["Petit (1,2 kg)", 3000], ["Moyen (1,5 kg)", 3500], ["Gros (2 kg)", 4500]]],
    ["Poulet fermier", "Poulet", "piece", 5500, 25, 8, 0, "poulet", "Poulet fermier à la chair ferme et goûteuse."],
    ["Cuisses de poulet", "Poulet", "kg", 2500, 45, 12, 0, "poulet", "Cuisses de poulet fraîches, à griller ou en sauce."],
    ["Ailes de poulet", "Poulet", "pack", 1800, 50, 15, 0, "poulet", "Paquet d'ailes de poulet (environ 1 kg), idéales pour l'apéritif."],
    ["Rognon de bœuf", "Rognons", "kg", 1700, 30, 8, 0, "rognon", "Rognons de bœuf frais, nettoyés avec soin. Rapport qualité/prix imbattable."],
    ["Rognon de porc", "Rognons", "kg", 1500, 24, 8, 0, "rognon", "Rognons de porc frais, parfaits sautés."],
    ["Foie de bœuf", "Rognons", "kg", 1900, 26, 8, 0, "rognon", "Foie de bœuf frais, riche en fer, tendre et savoureux."],
    ["Tripes de bœuf", "Tripes", "kg", 1500, 40, 10, 0, "tripes", "Tripes propres et blanchies, prêtes à cuisiner. Fraîcheur garantie."],
    ["Gras-double", "Tripes", "kg", 1800, 16, 6, 0, "tripes", "Gras-double nettoyé, tendre après cuisson lente."],
    ["Tête de porc", "Autres produits", "kg", 1000, 35, 10, 0, "tete-de-porc", "Tête de porc fraîche, au kilo. Idéale pour les bouillons et les plats traditionnels."],
    ["Pieds de porc", "Autres produits", "kg", 1200, 28, 8, 0, "tete-de-porc", "Pieds de porc frais et propres."],
    ["Crevettes", "Autres produits", "kg", 5000, 15, 5, 0, "crevettes", "Crevettes fraîches sur glace, à cuire rapidement.", undefined, [["Moyennes", 4500], ["Grosses", 5500], ["Jumbo", 7000]]],
    ["Darne de saumon", "Autres produits", "kg", 6500, 9, 4, 0, "saumon", "Darnes de saumon frais, tendres et riches en oméga-3."],
    ["Sachet de glace", "Autres produits", "pack", 500, 100, 20, 0, "poisson-mix", "Sachet de glace alimentaire pour conserver vos produits frais pendant le transport."],
  ];
  const prod: Record<string, { id: string; price: number; promo: number | null; unit: string; variants: { id: string; name: string; price: number }[] }> = {};
  const targets: Record<string, number> = {};
  for (const [i, [name, c, unit, price, stock, thr, , img, desc, promo, variants]] of PRODUCTS.entries()) {
    const labels = { kg: "kg", piece: "pièce", pack: "paquet", tray: "plateau" } as const;
    const p = (await one<{ id: string }>(
      `insert into products(category_id, slug, name, description, unit, unit_label, step, min_qty, allow_custom_qty, price, promo_price, promo_active, featured, sku, origin)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
      [cat[c], slugify(name), name, desc, unit, labels[unit], unit === "kg" ? 0.5 : 1, unit === "kg" ? 0.5 : 1, unit === "kg", price, promo ?? null, !!promo,
        ["Carpe fraîche", "Tilapia frais", "Rognon de bœuf", "Tripes de bœuf", "Poulet de chair entier", "Tête de porc", "Vivaneau rouge", "Crevettes"].includes(name),
        `JM-${String(i + 1).padStart(3, "0")}`, null]))!;
    await query("insert into product_images(product_id, url, alt) values ($1,$2,$3)", [p.id, IMG(img), `${name} — JM Poissonnerie`]);
    await query("insert into inventory(product_id, on_hand, alert_threshold) values ($1,0,$2)", [p.id, thr]);
    await tx((cx) => adjustStock(cx, p.id, "initial", 500, staff.stock, "Stock initial (démo)"));
    targets[p.id] = stock;
    const vs: { id: string; name: string; price: number }[] = [];
    for (const [j, [vn, vp]] of (variants ?? []).entries())
      vs.push((await one<any>("insert into product_variants(product_id, name, price, position) values ($1,$2,$3,$4) returning id, name, price", [p.id, vn, vp, j]))!);
    prod[name] = { id: p.id, price, promo: promo ?? null, unit, variants: vs };
  }
  await query("update products set promo_ends_at = now() + interval '30 days' where promo_active");

  await query("insert into coupons(code, type, value, min_order, max_uses) values ('BIENVENUE10','percent',10,5000,200), ('JM500','fixed',500,6000,null) on conflict do nothing");
  await query("insert into banners(title, subtitle, link_url, position) values ('Carpes fraîches à 1 400 FCFA/kg','Offre limitée — livraison possible','/promotions',0)");

  // ───── Commandes de démonstration ─────
  const [A, B, C] = [ZONES[0], ZONES[1], ZONES[2]];
  const zoneRows = await query<{ id: string; name: string }>("select id, name from delivery_zones order by sort_order");
  const Z = [zoneRows[0].id, zoneRows[1].id, zoneRows[2].id];
  void A; void B; void C;
  const quartiers = [["Cocody", "Begnery"], ["Cocody", "Carreaux Cassé"], ["Yopougon", "Niangon"], ["Abobo", "Sagbé"], ["Marcory", "Zone 4"], ["Treichville", "Arras"], ["Koumassi", "Remblais"], ["Adjamé", "Liberté"]];

  async function order(ci: number, lines: [string, number, number?][], o: Partial<CheckoutInput> & { target?: string; driver?: number; daysAgo?: number; hour?: number; fail?: boolean } = {}) {
    const cl = clients[ci % clients.length];
    const cart = (await one<{ id: string }>("insert into carts(user_id) values ($1) on conflict (user_id) do update set updated_at = now() returning id", [cl.id]))!;
    await query("delete from cart_items where cart_id = $1", [cart.id]);
    for (const [n, q, vi] of lines) {
      const p = prod[n];
      await query("insert into cart_items(cart_id, product_id, variant_id, quantity) values ($1,$2,$3,$4)", [cart.id, p.id, vi != null ? p.variants[vi].id : null, q]);
    }
    const [commune, quartier] = quartiers[ci % quartiers.length];
    const method = o.method ?? "standard";
    const res = await createOrder({
      userId: cl.id, customerName: cl.name, customerPhone: cl.phone, method, zoneId: method === "pickup" ? null : (o.zoneId ?? Z[ci % 2]),
      commune, quartier, address: `Rue ${10 + ci}, près du marché de ${quartier}`, landmark: "Près de la pharmacie", deliveryPhone: cl.phone, instructions: ci % 3 === 0 ? "Appelez en arrivant" : "",
      paymentMethod: o.paymentMethod ?? (ci % 2 ? "mobile_money" : "cash_on_delivery"), paymentReference: ci % 2 ? `MP${260900 + ci * 37}` : "", saveAddress: true,
    });
    const mgr = staff.manager;
    const t = o.target ?? "delivered";
    const needPay = (o.paymentMethod ?? (ci % 2 ? "mobile_money" : "cash_on_delivery")) !== "cash_on_delivery";
    const path: string[] = {
      received: [], payment_confirmed: ["payment_confirmed"], preparing: [needPay ? "payment_confirmed" : "", "preparing"], ready: [needPay ? "payment_confirmed" : "", "preparing", "ready"],
      handed_to_driver: [needPay ? "payment_confirmed" : "", "preparing", "handed_to_driver"], out_for_delivery: [needPay ? "payment_confirmed" : "", "preparing", "handed_to_driver", "out_for_delivery"],
      delivered: [needPay ? "payment_confirmed" : "", "preparing", ...(method === "pickup" ? ["ready"] : ["handed_to_driver", "out_for_delivery"]), "delivered"],
      cancelled: ["cancelled"], delivery_failed: [needPay ? "payment_confirmed" : "", "preparing", "handed_to_driver", "out_for_delivery", "delivery_failed"],
    }[t]!.filter(Boolean);
    const dr = drivers[(o.driver ?? ci) % drivers.length];
    if (method !== "pickup" && path.includes("handed_to_driver")) await assignDriver(res.id, dr.id, mgr);
    for (const s of path) {
      if (s === "out_for_delivery") await driverAccept(dr.userId, res.id);
      await changeStatus(res.id, s as any, ["handed_to_driver", "out_for_delivery", "delivered", "delivery_failed"].includes(s) && method !== "pickup" && s !== "handed_to_driver" ? dr.userId : mgr, s === "delivery_failed" ? "Client injoignable" : s === "cancelled" ? "Annulée à la demande du client" : undefined);
    }
    return res;
  }

  // Historique (13 derniers jours)
  const catalog = Object.keys(prod);
  const used: Record<string, number> = {};
  let seq = 0;
  for (let d = 13; d >= 1; d--) {
    const n = 2 + ((d * 7) % 4);
    for (let k = 0; k < n; k++) {
      seq++;
      const names = [catalog[(seq * 3) % catalog.length], catalog[(seq * 5 + 2) % catalog.length]];
      if (names[0] === names[1]) names[1] = catalog[(seq * 5 + 3) % catalog.length];
      const lines: [string, number, number?][] = names.map((nm, i) => [nm, prod[nm].unit === "kg" ? [1, 2, 0.5, 3][(seq + i) % 4] : [1, 2, 1, 3][(seq + i) % 4], prod[nm].variants.length ? 0 : undefined]);
      const target = seq % 17 === 0 ? "cancelled" : seq % 23 === 0 ? "delivery_failed" : "delivered";
      const hour = 8 + ((seq * 5) % 11);
      const res = await order(seq, lines, { target, driver: seq, method: seq % 9 === 0 ? "pickup" : seq % 5 === 0 ? "express" : "standard" });
      const day = new Date(Date.now() - d * 86400_000);
      const ymd = day.toISOString().slice(0, 10).replaceAll("-", "");
      used[ymd] = (used[ymd] ?? 0) + 1;
      const number = `JM-${ymd}-${String(used[ymd]).padStart(4, "0")}`;
      const base = new Date(day); base.setUTCHours(hour, (seq * 13) % 60, 0, 0);
      await query("update orders set created_at = $2::timestamptz, updated_at = $2::timestamptz + interval '95 minutes', number = $3 where id = $1", [res.id, base, number]);
      await query("update invoices set issued_at = $2::timestamptz, data = jsonb_set(data, '{order_number}', to_jsonb($3::text)) where order_id = $1", [res.id, base, number]);
      await query("update payments set created_at = $2::timestamptz, paid_at = case when paid_at is not null then $2::timestamptz + interval '10 minutes' end where order_id = $1", [res.id, base]);
      await query("update delivery_status_history h set created_at = $2::timestamptz + x.rn * interval '17 minutes' from (select id, row_number() over (order by id) rn from delivery_status_history where order_id = $1) x where h.id = x.id", [res.id, base]);
      await query(
        `update deliveries set assigned_at = $2::timestamptz + interval '25 minutes', accepted_at = $2::timestamptz + interval '30 minutes', started_at = case when started_at is not null then $2::timestamptz + interval '55 minutes' end,
                arrived_at = case when status = 'delivered' then $2::timestamptz + interval '85 minutes' end, delivered_at = case when delivered_at is not null then $2::timestamptz + interval '92 minutes' end,
                failed_at = case when failed_at is not null then $2::timestamptz + interval '88 minutes' end, last_lat = null, last_lng = null where order_id = $1`, [res.id, base]);
      await query("delete from notifications where link like '%' || $1 || '%'", [res.number]);
      await query("update inventory_movements set created_at = $2::timestamptz where order_id = $1", [res.id, base]);
    }
  }
  // Compteur du jour : repartir proprement après les commandes antidatées
  await query("delete from order_counters where day < (now() at time zone 'Africa/Abidjan')::date");
  await query("update order_counters set n = (select count(*) from orders where number like 'JM-' || to_char(day,'YYYYMMDD') || '-%') where day = (now() at time zone 'Africa/Abidjan')::date");

  // Aujourd'hui : un exemplaire de chaque statut
  await order(0, [["Carpe fraîche", 2], ["Tripes de bœuf", 1]], { target: "received", paymentMethod: "mobile_money" });
  await order(1, [["Rognon de bœuf", 1], ["Carpe fraîche", 1]], { target: "payment_confirmed", paymentMethod: "mobile_money" });
  await order(2, [["Poulet de chair entier", 2, 1], ["Cuisses de poulet", 1]], { target: "preparing", paymentMethod: "cash_on_delivery" });
  await order(3, [["Crevettes", 1, 1], ["Vivaneau rouge", 1]], { target: "handed_to_driver", paymentMethod: "cash_on_delivery", driver: 0, method: "express" });
  const live = await order(4, [["Tête de porc", 2], ["Carpe fraîche", 3]], { target: "out_for_delivery", paymentMethod: "cash_on_delivery", driver: 1 });
  await query("update deliveries set last_lat = 5.3600, last_lng = -3.9800, location_updated_at = now() where order_id = $1", [live.id]);
  await order(5, [["Maquereau", 2], ["Sardines fraîches", 1]], { target: "ready", method: "pickup", paymentMethod: "cash_on_delivery" });
  await order(6, [["Tilapia frais", 1.5]], { target: "delivered", paymentMethod: "cash_on_delivery", driver: 2 });

  // Avis sur commandes livrées
  const comments = ["Très frais, livraison rapide. Je recommande !", "Poisson de qualité, bien emballé avec de la glace.", "Bon rapport qualité/prix, je recommande.", "Livreur ponctuel et aimable, produit nickel.", "Un peu d'attente mais la fraîcheur est au rendez-vous.", "Excellent, comme au marché mais livré chez moi !"];
  const delivered = await query<any>("select o.id, o.user_id, o.created_at, oi.product_id from orders o join order_items oi on oi.order_id = o.id where o.status = 'delivered' and oi.product_id is not null order by o.created_at");
  let k = 0;
  for (const d of delivered) {
    if (k++ % 2 === 0) continue;
    await query("insert into reviews(product_id, user_id, order_id, rating, comment, created_at) values ($1,$2,$3,$4,$5,$6) on conflict do nothing", [d.product_id, d.user_id, d.id, [5, 5, 4, 5, 4][k % 5], comments[k % comments.length], new Date(new Date(d.created_at).getTime() + 3 * 3600_000)]);
  }
  for (const [i, cl] of clients.entries()) for (const n of [catalog[i], catalog[(i + 4) % catalog.length]]) await query("insert into favorites(user_id, product_id) values ($1,$2) on conflict do nothing", [cl.id, prod[n].id]);

  // Stock final de démonstration (disponible = valeur cible)
  for (const [pid, target] of Object.entries(targets))
    await query("update inventory set on_hand = $2 + reserved, low_alert_sent = false, sold = sold, updated_at = now() where product_id = $1", [pid, target]);
  await query("update inventory set low_alert_sent = (on_hand - reserved <= alert_threshold)");
  await query("delete from notifications where type = 'stock_low'");
  await query("insert into notifications(user_id, type, title, body, link) select u.id, 'stock_low', 'Stock faible : Tilapia frais', 'Il reste 8 kg (seuil d''alerte : 10).', '/admin/stock' from users u where u.role_key in ('super_admin','manager','stock_manager')");
  await query("update notifications set read_at = now() - interval '1 day' where created_at < now() - interval '1 day'");

  console.log(`✔ données de démonstration créées\n  Mot de passe de tous les comptes démo : ${PASSWORD}\n  Super admin 0700000001 · Gérant 0700000002 · Stock 0700000003 · Préparateur 0700000004\n  Livreurs 0700000011/12/13 · Clients 0700000100…107`);
  await pool().end();
}
main().catch((e) => { console.error(e); process.exit(1); });
