import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import type { AccountDetail } from "@/types/account";
import { formatProductSummary } from "@/lib/formatters";

interface StoreInfo {
  name: string;
  address?: string;
  phone?: string;
}

const HEADER_COLOR: [number, number, number] = [16, 185, 129];
const OVERDUE_COLOR: [number, number, number] = [239, 68, 68];
const peso = (n: number) => `₱${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export async function toStatementOfAccount(account: AccountDetail, store: StoreInfo) {
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
  doc.text("STATEMENT OF ACCOUNT", pw / 2, y, { align: "center" });
  y += 9;

  // Account summary block
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const leftX = 14;
  const colX = 80;
  const rightCol = pw / 2 + 5;
  const rightVal = rightCol + 55;

  const leftDetails: [string, string][] = [
    ["Account #:", `#${account.id}`],
    ["Customer:", account.customer_name],
    ["Date Opened:", account.start_date ?? account.created_at.slice(0, 10)],
  ];
  const rightDetails: [string, string][] = [
    ["Principal:", peso(account.principal)],
    ["Down Payment:", peso(account.down_payment)],
    ["Interest Rate:", `${account.interest_rate}%`],
    ["Penalty Rate:", `${account.penalty_rate}%`],
  ];

  const blockStart = y;
  for (const [label, val] of leftDetails) {
    doc.setFont("helvetica", "bold"); doc.text(label, leftX, y);
    doc.setFont("helvetica", "normal"); doc.text(val, colX, y);
    y += 6;
  }

  y = blockStart;
  for (const [label, val] of rightDetails) {
    doc.setFont("helvetica", "bold"); doc.text(label, rightCol, y);
    doc.setFont("helvetica", "normal"); doc.text(val, rightVal, y);
    y += 6;
  }

  // Product on its own full-width row to avoid overflow from long names/attributes
  y = blockStart + Math.max(leftDetails.length, rightDetails.length) * 6;
  doc.setFont("helvetica", "bold");
  doc.text("Product:", leftX, y);
  doc.setFont("helvetica", "normal");
  doc.text(formatProductSummary(account.product_summary), colX, y, { maxWidth: pw - colX - 14 });
  y += 8;

  // Balance / status highlight
  const statusColor = account.is_overdue ? OVERDUE_COLOR : HEADER_COLOR;
  doc.setFillColor(...statusColor);
  doc.roundedRect(leftX, y, pw - 28, 12, 2, 2, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text(`Balance Remaining: ${peso(account.balance_remaining)}`, leftX + 4, y + 8);
  const statusLabel = account.status.toUpperCase();
  doc.text(statusLabel, pw - 18, y + 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y += 18;

  // Payment Schedule table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Schedule", leftX, y);
  y += 4;

  const schedRows = account.schedule.map((entry, i) => {
    const statusColor =
      entry.status === "paid" ? [22, 163, 74] :
      entry.status === "overdue" ? [239, 68, 68] :
      entry.status === "partial" ? [234, 179, 8] :
      [100, 116, 139];
    return {
      cells: [String(i + 1), entry.due_date, peso(entry.amount_due), peso(entry.amount_paid), entry.status.toUpperCase()],
      statusColor,
    };
  });

  autoTable(doc, {
    startY: y,
    head: [["#", "Due Date", "Amount Due", "Amount Paid", "Status"]],
    body: schedRows.map((r) => r.cells),
    styles: { fontSize: 8 },
    headStyles: { fillColor: HEADER_COLOR },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 38 },
      2: { halign: "center", cellWidth: 44 },
      3: { halign: "center", cellWidth: 44 },
      4: { halign: "center", cellWidth: 44 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 2) {
        data.cell.styles.halign = "center";
      }
      if (data.column.index === 4 && data.section === "body") {
        const row = schedRows[data.row.index];
        if (row) {
          const [r, g, b] = row.statusColor;
          data.cell.styles.textColor = [r, g, b];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const afterSched = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y + 60;
  y = afterSched + 8;

  // Payment History table
  if (y > doc.internal.pageSize.getHeight() - 40) {
    doc.addPage();
    y = 20;
  }

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment History", leftX, y);
  y += 4;

  // Build running balance column
  let runningBalance = account.principal;
  const historyRows: (string | number)[][] = [];

  for (const pmt of account.payments) {
    const isFee = pmt.type === "penalty" || pmt.type === "interest_adjustment";
    const isRebate = pmt.type === "rebate";
    if (!isFee && !isRebate) {
      runningBalance -= pmt.amount;
    }
    historyRows.push([
      pmt.payment_date,
      pmt.type.charAt(0).toUpperCase() + pmt.type.slice(1).replace("_", " "),
      pmt.type === "penalty" ? `+${peso(pmt.amount)}` : isRebate ? `(${peso(Math.abs(pmt.amount))})` : peso(pmt.amount),
      peso(Math.max(0, runningBalance)),
      pmt.notes ?? "—",
    ]);
  }

  autoTable(doc, {
    startY: y,
    head: [["Date", "Type", "Amount", "Running Balance", "Notes"]],
    body: historyRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: HEADER_COLOR },
    columnStyles: { 2: { halign: "right" }, 3: { halign: "right" } },
  });

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
    defaultPath: `soa_${account.customer_name.replace(/[^a-z0-9]/gi, '_')}_acc${account.id}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
}
