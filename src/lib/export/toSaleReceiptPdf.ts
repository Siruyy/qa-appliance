import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { SaleDetail } from "@/types/sale";

interface StoreInfo {
  name: string;
  address?: string;
  phone?: string;
  footer?: string;
}

const HEADER_COLOR: [number, number, number] = [16, 185, 129];
const peso = (n: number) => `₱${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export async function toSaleReceiptPdf(detail: SaleDetail, store: StoreInfo) {
  const { sale, items, account } = detail;
  const doc = new jsPDF({ orientation: "portrait", format: "a5" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 12;

  // Store header
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(store.name, pw / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  if (store.address) { doc.text(store.address, pw / 2, y, { align: "center" }); y += 4; }
  if (store.phone) { doc.text(store.phone, pw / 2, y, { align: "center" }); y += 4; }

  y += 2;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.4);
  doc.line(14, y, pw - 14, y);
  y += 4;

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("SALES RECEIPT", pw / 2, y, { align: "center" });
  y += 7;

  // Receipt meta
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(`Receipt #: ${sale.id}`, 14, y);
  doc.text(`Date: ${sale.sale_date}`, pw - 14, y, { align: "right" });
  y += 5;
  if (sale.customer_name) {
    doc.text(`Customer: ${sale.customer_name}`, 14, y);
    y += 5;
  }
  doc.setDrawColor(220, 220, 220);
  doc.line(14, y, pw - 14, y);
  y += 4;

  // Items table
  const hasItemDiscount = items.some((i) => i.item_discount > 0);
  const itemHeaders = hasItemDiscount
    ? ["Item", "Qty", "Price", "Disc", "Subtotal"]
    : ["Item", "Qty", "Unit Price", "Subtotal"];

  const itemRows = items.map((item) => {
    const label = [item.product_name, item.variant_label].filter(Boolean).join(" – ");
    if (hasItemDiscount) {
      return [
        label,
        String(item.quantity),
        peso(item.unit_price),
        item.item_discount > 0
          ? item.item_discount_type === "percent"
            ? `${item.item_discount_value}%`
            : peso(item.item_discount)
          : "—",
        peso(item.subtotal),
      ];
    }
    return [label, String(item.quantity), peso(item.unit_price), peso(item.subtotal)];
  });

  autoTable(doc, {
    startY: y,
    head: [itemHeaders],
    body: itemRows,
    styles: { fontSize: 7 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: {
      [itemHeaders.length - 1]: { halign: "right" },
      [itemHeaders.length - 2]: { halign: "right" },
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;

  // Totals
  const totalsX = pw - 14;
  doc.setFontSize(8);
  const totals: [string, string][] = [
    ["Subtotal:", peso(sale.subtotal)],
  ];
  if (sale.discount > 0) {
    const discLabel = sale.discount_type === "percent"
      ? `Discount (${sale.discount_value}%):`
      : "Discount:";
    totals.push([discLabel, `(${peso(sale.discount)})`]);
  }
  totals.push(["TOTAL:", peso(sale.total)]);

  for (const [label, val] of totals) {
    const isBold = label === "TOTAL:";
    doc.setFont("helvetica", isBold ? "bold" : "normal");
    if (isBold) doc.setFontSize(9);
    doc.text(label, totalsX - 50, y);
    doc.text(val, totalsX, y, { align: "right" });
    y += isBold ? 6 : 5;
  }

  // Payment method
  y += 1;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    `Payment Method: ${sale.payment_type === "installment" ? "Installment" : "Cash"}`,
    14, y
  );
  y += 5;

  // Installment summary
  if (account) {
    doc.setDrawColor(220, 220, 220);
    doc.line(14, y, pw - 14, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text("Installment Details", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    const instDetails: [string, string][] = [
      ["Principal:", peso(account.principal)],
      ["Down Payment:", peso(account.down_payment)],
      ["Monthly:", account.monthly_amount ? peso(account.monthly_amount) : "—"],
      ["Term:", account.term_months ? `${account.term_months} months` : "—"],
      ["Balance:", peso(account.balance_remaining)],
    ];
    for (const [label, val] of instDetails) {
      doc.text(label, 14, y);
      doc.text(val, totalsX, y, { align: "right" });
      y += 5;
    }
  }

  // Footer
  if (store.footer) {
    y += 4;
    doc.setDrawColor(16, 185, 129);
    doc.line(14, y, pw - 14, y);
    y += 4;
    doc.setFontSize(7);
    doc.setTextColor(100, 100, 100);
    doc.text(store.footer, pw / 2, y, { align: "center", maxWidth: pw - 28 });
    doc.setTextColor(0, 0, 0);
  }

  const pageH = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Printed: ${new Date().toLocaleDateString()}`, pw / 2, pageH - 6, { align: "center" });
  doc.setTextColor(0, 0, 0);

  const path = await save({
    defaultPath: `receipt_sale_${sale.id}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
}
