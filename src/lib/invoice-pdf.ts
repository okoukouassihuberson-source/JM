import path from "node:path";
import PDFDocument from "pdfkit";
import { fcfa, fmtDateTime, formatQty, displayPhone } from "./format";
import { PAY_STATUS_LABEL, PAYMENT_LABEL, METHOD_LABEL } from "./orders";

const NAVY = "#0a1a52", BLUE = "#1e6bff", MUTED = "#5b6785", LINE = "#dde5f2";

type InvoiceData = any;

export function renderInvoice(inv: { number: string; issued_at: Date; data: InvoiceData }, pay: { status: string; method: string; reference: string | null }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 44, info: { Title: `Facture ${inv.number}`, Author: inv.data.shop.name } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    const d = inv.data, W = doc.page.width - 88;

    try { doc.image(path.join(process.cwd(), "public/images/brand/logo.jpg"), 44, 36, { width: 170 }); } catch { doc.font("Helvetica-Bold").fontSize(18).fillColor(NAVY).text(d.shop.name, 44, 44); }
    doc.font("Helvetica-Bold").fontSize(26).fillColor(NAVY).text("FACTURE", 300, 40, { width: W - 256, align: "right" });
    doc.font("Helvetica").fontSize(10).fillColor(MUTED)
      .text(`N° ${inv.number}`, 300, 72, { width: W - 256, align: "right" })
      .text(`Commande ${d.order_number}`, { width: W - 256, align: "right" })
      .text(`Émise le ${fmtDateTime(inv.issued_at)}`, { width: W - 256, align: "right" });

    // Parties
    let y = 130;
    doc.moveTo(44, y).lineTo(44 + W, y).strokeColor(LINE).stroke();
    y += 14;
    doc.font("Helvetica-Bold").fontSize(8).fillColor(BLUE).text("ÉMETTEUR", 44, y).text("FACTURÉ À", 320, y);
    doc.font("Helvetica-Bold").fontSize(11).fillColor(NAVY).text(d.shop.name, 44, y + 14).text(d.customer.name, 320, y + 14);
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
      .text(d.shop.address || "", 44, y + 30, { width: 240 })
      .text(`Tél. ${displayPhone(String(d.shop.phone).replace(/\D/g, "").length === 10 ? "225" + String(d.shop.phone).replace(/\D/g, "") : String(d.shop.phone))}`, 44)
      .text(d.shop.email || "", 44);
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED)
      .text(`Tél. ${displayPhone(d.customer.phone)}`, 320, y + 30, { width: 230 })
      .text(d.delivery_method === "pickup" ? "Retrait sur place" : d.customer.address || "", 320, doc.y, { width: 230 });

    // Lignes
    y = 255;
    doc.rect(44, y, W, 24).fill(NAVY);
    doc.font("Helvetica-Bold").fontSize(9).fillColor("#fff")
      .text("PRODUIT", 54, y + 8).text("QTÉ", 290, y + 8, { width: 70, align: "right" }).text("PRIX UNIT.", 365, y + 8, { width: 80, align: "right" }).text("TOTAL", 450, y + 8, { width: 88, align: "right" });
    y += 24;
    for (const it of d.items) {
      const label = it.variant_name ? `${it.name} (${it.variant_name})` : it.name;
      doc.font("Helvetica").fontSize(10).fillColor(NAVY).text(label, 54, y + 9, { width: 225 });
      const h = Math.max(30, doc.y - y + 8);
      doc.fillColor(NAVY)
        .text(formatQty(it.quantity, it), 290, y + 9, { width: 70, align: "right" })
        .text(fcfa(it.unit_price), 365, y + 9, { width: 80, align: "right" })
        .font("Helvetica-Bold").text(fcfa(it.line_total), 450, y + 9, { width: 88, align: "right" });
      y += h;
      doc.moveTo(44, y).lineTo(44 + W, y).strokeColor(LINE).stroke();
      if (y > 700) { doc.addPage(); y = 50; }
    }

    // Totaux
    y += 14;
    const row = (l: string, v: string, bold = false, color = NAVY) => {
      doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 13 : 10).fillColor(color).text(l, 330, y, { width: 110 }).text(v, 440, y, { width: 98, align: "right" });
      y += bold ? 24 : 18;
    };
    row("Sous-total", fcfa(d.subtotal));
    row(`Livraison${d.zone ? ` (${d.zone})` : ""}`, d.delivery_fee ? fcfa(d.delivery_fee) : "Offerte");
    if (d.discount) row(`Réduction${d.coupon ? ` (${d.coupon})` : ""}`, `- ${fcfa(d.discount)}`, false, "#d91f26");
    doc.moveTo(330, y).lineTo(44 + W, y).strokeColor(NAVY).stroke(); y += 8;
    row("TOTAL", fcfa(d.total), true);

    // Paiement
    y += 10;
    doc.roundedRect(44, y, W, 56, 8).fill("#f1f6ff");
    doc.font("Helvetica-Bold").fontSize(9).fillColor(BLUE).text("PAIEMENT", 58, y + 10);
    doc.font("Helvetica").fontSize(10).fillColor(NAVY)
      .text(`${PAYMENT_LABEL[pay.method] ?? pay.method} — ${PAY_STATUS_LABEL[pay.status] ?? pay.status}`, 58, y + 24)
      .text(`${METHOD_LABEL[d.delivery_method as keyof typeof METHOD_LABEL]}${pay.reference ? `   •   Réf. ${pay.reference}` : ""}`, 58, y + 38);

    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("Fraîcheur, Qualité, Confiance… Chaque jour pour vous !", 44, 770, { width: W, align: "center" });
    doc.end();
  });
}
