import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

interface CsvExportOptions {
  filename: string;
  headers: string[];
  rows: (string | number | null)[][];
}

function escapeCsv(val: string | number | null): string {
  if (val === null) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function toCsv({ filename, headers, rows }: CsvExportOptions) {
  const path = await save({
    defaultPath: `${filename}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return; // user cancelled

  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ];

  const encoder = new TextEncoder();
  await writeFile(path, encoder.encode(bom + lines.join("\n")));
}
