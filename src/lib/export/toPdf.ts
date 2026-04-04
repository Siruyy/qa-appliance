import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface PdfExportOptions {
  filename: string;
  title: string;
  dateRange?: string;
  kpis?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number | null)[][];
  orientation?: "portrait" | "landscape";
}

export function toPdf({
  filename,
  title,
  dateRange,
  kpis,
  headers,
  rows,
  orientation,
}: PdfExportOptions) {
  const doc = new jsPDF({
    orientation: orientation ?? (headers.length > 6 ? "landscape" : "portrait"),
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header
  doc.setFontSize(16);
  doc.text("Quality Appliance", 14, 20);
  doc.setFontSize(12);
  doc.text(title, 14, 28);

  let y = 36;
  if (dateRange) {
    doc.setFontSize(9);
    doc.text(dateRange, 14, y);
    y += 6;
  }

  doc.setFontSize(8);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, y);
  y += 8;

  // KPI summary
  if (kpis && kpis.length > 0) {
    doc.setFontSize(10);
    const kpiText = kpis.map((k) => `${k.label}: ${k.value}`).join("   |   ");
    doc.text(kpiText, 14, y, { maxWidth: pageWidth - 28 });
    y += 10;
  }

  // Auto table
  autoTable(doc, {
    startY: y,
    head: [headers],
    body: rows.map((r) => r.map((c) => (c === null ? "—" : String(c)))),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [37, 99, 235] },
    didDrawPage: (data) => {
      // Footer with page number
      const pageCount = doc.getNumberOfPages();
      doc.setFontSize(8);
      doc.text(
        `Page ${data.pageNumber} of ${pageCount}`,
        pageWidth - 30,
        doc.internal.pageSize.getHeight() - 10
      );
    },
  });

  doc.save(`${filename}.pdf`);
}
