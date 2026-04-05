import * as XLSX from "xlsx";
import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface SheetData {
  sheetName: string;
  headers: string[];
  rows: (string | number | null)[][];
}

interface ExcelExportOptions {
  filename: string;
  sheetName?: string;
  kpis?: { label: string; value: string | number }[];
  headers: string[];
  rows: (string | number | null)[][];
}

interface ExcelMultiSheetOptions {
  filename: string;
  kpis?: { label: string; value: string | number }[];
  sheets: SheetData[];
}

function appendSheet(wb: XLSX.WorkBook, name: string, headers: string[], rows: (string | number | null)[][]) {
  const data = [headers, ...rows];
  const ws = XLSX.utils.aoa_to_sheet(data);
  ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 15) }));
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function appendKpis(wb: XLSX.WorkBook, kpis: { label: string; value: string | number }[]) {
  const summaryData = kpis.map((k) => [k.label, k.value]);
  const ws = XLSX.utils.aoa_to_sheet([["Metric", "Value"], ...summaryData]);
  ws["!cols"] = [{ wch: 25 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, "Summary");
}

async function writeWorkbook(wb: XLSX.WorkBook, filename: string) {
  const path = await save({
    defaultPath: `${filename}.xlsx`,
    filters: [{ name: "Excel", extensions: ["xlsx"] }],
  });
  if (!path) return;
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  await writeFile(path, new Uint8Array(buf));
}

export async function toExcel({ filename, sheetName, kpis, headers, rows }: ExcelExportOptions) {
  const wb = XLSX.utils.book_new();
  if (kpis && kpis.length > 0) appendKpis(wb, kpis);
  appendSheet(wb, sheetName ?? "Data", headers, rows);
  await writeWorkbook(wb, filename);
}

export async function toExcelMultiSheet({ filename, kpis, sheets }: ExcelMultiSheetOptions) {
  const wb = XLSX.utils.book_new();
  if (kpis && kpis.length > 0) appendKpis(wb, kpis);
  for (const s of sheets) {
    appendSheet(wb, s.sheetName, s.headers, s.rows);
  }
  await writeWorkbook(wb, filename);
}
