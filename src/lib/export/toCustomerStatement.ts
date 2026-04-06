import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { CustomerDetail } from "@/types/customer";

interface StoreInfo {
  name: string;
  address?: string;
  phone?: string;
}

const HEADER_COLOR: [number, number, number] = [16, 185, 129];
const peso = (n: number) => `₱${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export async function toCustomerStatement(detail: CustomerDetail, store: StoreInfo) {
  const { customer, sales, accounts, payments } = detail;
  const doc = new jsPDF({ orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 14;

  // Store header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(store.name, pw / 2, y, { align: "center" });
  y += 7;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (store.address) { doc.text(store.address, pw / 2, y, { align: "center" }); y += 5; }
  if (store.phone) { doc.text(store.phone, pw / 2, y, { align: "center" }); y += 5; }

  y += 3;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(14, y, pw - 14, y);
  y += 5;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER STATEMENT", pw / 2, y, { align: "center" });
  y += 9;

  // Customer info
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Customer: ${customer.name}`, 14, y);
  if (customer.phone) doc.text(`Phone: ${customer.phone}`, pw / 2, y);
  y += 5;
  if (customer.address) {
    doc.text(`Address: ${customer.address}`, 14, y);
    y += 5;
  }
  y += 2;

  // Summary KPIs
  const totalBorrowed = accounts.reduce((sum, a) => sum + a.principal, 0);
  const totalOutstanding = accounts.reduce((sum, a) => sum + a.balance_remaining, 0);
  const totalPaid = payments
    .filter((p) => p.type === "payment" || p.type === "down_payment")
    .reduce((sum, p) => sum + p.amount, 0);
  const openAccounts = accounts.filter((a) => a.status === "open").length;
  const totalSalesAmt = sales.reduce((sum, s) => sum + s.total, 0);

  doc.setFillColor(240, 253, 250);
  doc.roundedRect(14, y, pw - 28, 18, 2, 2, "F");
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const kpis: [string, string, number][] = [
    ["Total Sales", peso(totalSalesAmt), 14],
    ["Total Borrowed", peso(totalBorrowed), 14 + (pw - 28) * 0.25],
    ["Total Paid", peso(totalPaid), 14 + (pw - 28) * 0.5],
    ["Outstanding", peso(totalOutstanding), 14 + (pw - 28) * 0.75],
  ];
  for (const [label, val, x] of kpis) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.text(label, x, y + 6);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text(val, x, y + 13);
  }
  y += 24;

  // Accounts table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Installment Accounts", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "Principal", "Paid", "Balance", "Term", "Status"]],
    body: accounts.map((a) => {
      const paid = payments
        .filter((p) => p.account_id === a.id && (p.type === "payment" || p.type === "down_payment"))
        .reduce((sum, p) => sum + p.amount, 0);
      return [
        String(a.id),
        a.items_summary,
        peso(a.principal),
        peso(paid),
        peso(a.balance_remaining),
        a.term_months ? `${a.term_months} mo` : "N/A",
        a.status.toUpperCase(),
      ];
    }),
    styles: { fontSize: 7 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" } },
    foot: accounts.length > 0
      ? [["", "Total", peso(totalBorrowed), peso(totalPaid), peso(totalOutstanding), "", ""]]
      : undefined,
    footStyles: { fillColor: [230, 230, 230], fontStyle: "bold", fontSize: 7 },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Sales table
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Sales History", 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["#", "Date", "Items", "Total", "Type", "Status"]],
    body: sales.map((s) => [
      String(s.id),
      s.sale_date,
      s.items_summary,
      peso(s.total),
      s.payment_type,
      s.status,
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 3: { halign: "right" } },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Payment history table
  if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 20; }
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Payment History (${payments.length} records)`, 14, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    head: [["Date", "Account #", "Type", "Amount", "Notes"]],
    body: payments.map((p) => [
      p.payment_date,
      String(p.account_id),
      p.type.charAt(0).toUpperCase() + p.type.slice(1).replace("_", " "),
      peso(p.amount),
      p.notes ?? "—",
    ]),
    styles: { fontSize: 7 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 3: { halign: "right" } },
  });

  // Open accounts note
  if (openAccounts > 0) {
    const lastY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text(`* This customer has ${openAccounts} open account${openAccounts > 1 ? "s" : ""} with an outstanding balance of ${peso(totalOutstanding)}.`, 14, lastY);
    doc.setTextColor(0, 0, 0);
  }

  // Page numbers
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Page ${i} of ${pages}  |  Generated: ${new Date().toLocaleDateString()}`,
      pw / 2, doc.internal.pageSize.getHeight() - 8,
      { align: "center" }
    );
    doc.setTextColor(0, 0, 0);
  }

  const path = await save({
    defaultPath: `customer_statement_${customer.id}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
}
