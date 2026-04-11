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
const peso = (n: number) => `₱${n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;

export async function toInstallmentPlan(account: AccountDetail, store: StoreInfo) {
  const doc = new jsPDF({ orientation: "portrait" });
  const pw = doc.internal.pageSize.getWidth();
  let y = 14;

  // Store header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(store.name, pw / 2, y, { align: "center" });
  y += 7;
  if (store.address) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(store.address, pw / 2, y, { align: "center" });
    y += 5;
  }
  if (store.phone) {
    doc.setFontSize(9);
    doc.text(store.phone, pw / 2, y, { align: "center" });
    y += 5;
  }

  // Title rule
  y += 3;
  doc.setDrawColor(16, 185, 129);
  doc.setLineWidth(0.5);
  doc.line(14, y, pw - 14, y);
  y += 5;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text("INSTALLMENT PLAN", pw / 2, y, { align: "center" });
  y += 9;

  // Account details block
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const leftX = 14;
  const colX = 80;

  const details: [string, string][] = [
    ["Account #:", `#${account.id}`],
    ["Customer:", account.customer_name],
    ["Product:", formatProductSummary(account.product_summary)],
    ["Date Opened:", account.start_date ?? account.created_at.slice(0, 10)],
    ["Principal Amount:", peso(account.principal)],
    ["Down Payment:", peso(account.down_payment)],
    ["Interest Rate:", `${account.interest_rate}% (flat / add-on)`],
    ["Loan Term:", account.term_months ? `${account.term_months} months` : "—"],
    ["Monthly Payment:", account.monthly_amount ? peso(account.monthly_amount) : "—"],
  ];
  if (account.rebate_amount > 0) {
    details.push(["Early Payment Rebate:", `₱${account.rebate_amount.toFixed(2)}`]);
  }

  for (const [label, val] of details) {
    doc.setFont("helvetica", "bold");
    doc.text(label, leftX, y);
    doc.setFont("helvetica", "normal");
    doc.text(val, colX, y);
    y += 6;
  }

  if (account.rebate_amount > 0) {
    y += 2;
    doc.setFontSize(8);
    doc.setTextColor(16, 185, 129);
    doc.text(
      `* Early payment rebate of ₱${account.rebate_amount.toFixed(2)} will be credited if all payments are made on or before their due date.`,
      leftX, y, { maxWidth: pw - 28 }
    );
    doc.setTextColor(0, 0, 0);
    y += 9;
  }

  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, pw - 14, y);
  y += 4;

  // Payment schedule table
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Schedule", leftX, y);
  y += 4;

  const schedRows = account.schedule.map((entry, i) => [
    String(i + 1),
    entry.due_date,
    peso(entry.amount_due),
    entry.amount_paid > 0 ? peso(entry.amount_paid) : "—",
    entry.status.toUpperCase(),
  ]);

  autoTable(doc, {
    startY: y,
    head: [["#", "Due Date", "Amount Due", "Amt Paid", "Status"]],
    body: schedRows,
    styles: { fontSize: 8 },
    headStyles: { fillColor: HEADER_COLOR },
    tableWidth: 182,
    columnStyles: {
      0: { cellWidth: 12 },
      1: { cellWidth: 38 },
      2: { halign: "center", cellWidth: 45 },
      3: { halign: "center", cellWidth: 45 },
      4: { halign: "center", cellWidth: 42 },
    },
    didParseCell: (data) => {
      if (data.section === "head" && data.column.index >= 2) {
        data.cell.styles.halign = "center";
      }
      if (data.column.index === 4 && data.section === "body") {
        const entry = account.schedule[data.row.index];
        if (entry) {
          if (entry.status === "paid") data.cell.styles.textColor = [22, 163, 74];
          else if (entry.status === "overdue") data.cell.styles.textColor = [239, 68, 68];
          else if (entry.status === "partial") data.cell.styles.textColor = [234, 179, 8];
          data.cell.styles.fontStyle = "bold";
        }
      }
    },
  });

  const afterTable = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY ?? y + 40;

  // Signature lines
  const sigY = afterTable + 20;
  if (sigY < doc.internal.pageSize.getHeight() - 30) {
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.line(leftX, sigY, leftX + 70, sigY);
    doc.text("Customer's Signature over Printed Name", leftX, sigY + 5);
    doc.line(pw - 84, sigY, pw - 14, sigY);
    doc.text("Staff / Authorized Signature", pw - 84, sigY + 5);
    doc.setFontSize(8);
    doc.text(`Date: ____________________`, leftX, sigY + 14);
  }

  // Footer
  const fh = doc.internal.pageSize.getHeight();
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, pw / 2, fh - 8, { align: "center" });
  doc.setTextColor(0, 0, 0);

  const path = await save({
    defaultPath: `installment_plan_${account.customer_name.replace(/[^a-z0-9]/gi, '_')}_acc${account.id}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return;
  await writeFile(path, new Uint8Array(doc.output("arraybuffer")));
}
