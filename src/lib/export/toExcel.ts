import * as XLSX from "xlsx";

interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  kpis?: { label: string; value: string | number }[];
  headers: string[];
  rows: (string | number | null)[][];
}

export function toExcel({ filename, sheetName, kpis, headers, rows }: ExcelExportOptions) {
  const wb = XLSX.utils.book_new();

  // KPI summary sheet
  if (kpis && kpis.length > 0) {
    const summaryData = kpis.map((k) => [k.label, k.value]);
    const summarySheet = XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...summaryData]);
    summarySheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, summarySheet, "Summary");
  }

  // Detail sheet
  const detailData = [headers, ...rows];
  const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
  detailSheet["!cols"] = headers.map((h) => ({
    wch: Math.max(h.length + 2, 15),
  }));
  XLSX.utils.book_append_sheet(wb, detailSheet, sheetName ?? "Data");

  XLSX.writeFile(wb, `${filename}.xlsx`);
}
