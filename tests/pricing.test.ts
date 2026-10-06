import assert from "node:assert/strict";
import { test } from "node:test";
import { clampQty, deliveryFee, lineTotal, promoLive, stepQty, unitPrice, validQty } from "../src/lib/pricing";
import { displayPhone, fcfa, formatQty, normalizePhone } from "../src/lib/format";
import { hashPassword, verifyPassword } from "../src/lib/security";

const carpe = { price: 1700, promo_price: 1400, promo_active: true, promo_ends_at: null };
const kg = { unit: "kg", step: 0.5, min_qty: 0.5, allow_custom_qty: true };

test("prix au poids : 500 g / 1 kg / 2 kg", () => {
  assert.equal(lineTotal(1400, 0.5), 700);
  assert.equal(lineTotal(1400, 1), 1400);
  assert.equal(lineTotal(1400, 2), 2800);
});

test("promotion : -18 %, expirée ou désactivée", () => {
  assert.deepEqual(unitPrice(carpe), { price: 1400, original: 1700, discountPct: 18, onPromo: true });
  assert.equal(promoLive({ ...carpe, promo_ends_at: new Date(Date.now() - 1000) }), false);
  assert.equal(unitPrice({ ...carpe, promo_active: false }).price, 1700);
  assert.equal(promoLive({ ...carpe, promo_price: 1700 }), false);
});

test("variante : la remise du produit s'applique proportionnellement", () => {
  assert.equal(unitPrice(carpe, 3400).price, Math.round(3400 * (1400 / 1700)));
});

test("quantités : pas, minimum, maximum, saisie libre", () => {
  assert.equal(stepQty(0.5, 1, kg), 1);
  assert.equal(stepQty(0.5, -1, kg), 0.5);
  assert.equal(clampQty(0.1, kg), 0.5);
  assert.equal(clampQty(1.234, kg), 1.23);
  assert.equal(clampQty(1.3, { ...kg, allow_custom_qty: false }), 1.5);
  assert.equal(validQty(1.5, { ...kg, allow_custom_qty: false }), true);
  assert.equal(validQty(1.3, { ...kg, allow_custom_qty: false }), false);
  assert.equal(validQty(9999, kg), false);
  assert.equal(validQty(NaN, kg), false);
});

test("frais de livraison : zone, express, retrait, seuil de gratuité", () => {
  const o = { expressSupplement: 1000, freeThreshold: 15000 };
  assert.equal(deliveryFee("standard", 1000, o, 5000), 1000);
  assert.equal(deliveryFee("express", 1000, o, 5000), 2000);
  assert.equal(deliveryFee("pickup", 1000, o, 5000), 0);
  assert.equal(deliveryFee("standard", 1500, o, 15000), 0);
  assert.equal(deliveryFee("express", 1500, o, 20000), 2500);
});

test("formatage FCFA, quantités et téléphones", () => {
  assert.equal(fcfa(1400), "1 400 FCFA");
  assert.equal(fcfa(1234567), "1 234 567 FCFA");
  assert.equal(formatQty(0.5, { unit: "kg", unit_label: "kg" }), "500 g");
  assert.equal(formatQty(1.5, { unit: "kg", unit_label: "kg" }), "1,5 kg");
  assert.equal(formatQty(3, { unit: "piece", unit_label: "pièce" }), "3 pièces");
  assert.equal(normalizePhone("07 10 36 99 75"), "2250710369975");
  assert.equal(normalizePhone("+225 07 10 36 99 75"), "2250710369975");
  assert.equal(normalizePhone("00225 0710369975"), "2250710369975");
  assert.equal(normalizePhone("abc"), null);
  assert.equal(displayPhone("2250710369975"), "07 10 36 99 75");
});

test("mots de passe : hash scrypt salé, vérification, jamais en clair", async () => {
  const h = await hashPassword("Secret#2026");
  assert.ok(h.startsWith("scrypt$") && !h.includes("Secret"));
  assert.notEqual(h, await hashPassword("Secret#2026"), "sel aléatoire");
  assert.equal(await verifyPassword("Secret#2026", h), true);
  assert.equal(await verifyPassword("secret#2026", h), false);
  assert.equal(await verifyPassword("x", "n'importe quoi"), false);
});
