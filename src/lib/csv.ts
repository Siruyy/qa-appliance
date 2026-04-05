import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";

/**
 * Convert an array of objects to CSV and save via native file dialog.
 */
export async function downloadCsv<T extends object>(
  data: T[],
  filename: string,
  columns?: { key: string; label: string }[]
) {
  if (data.length === 0) return;

  const cols = columns ?? (Object.keys(data[0]) as string[]).map((k) => ({ key: k, label: k }));

  const header = cols.map((c) => escapeCsvField(c.label)).join(",");
  const rows = data.map((row) =>
    cols.map((c) => escapeCsvField(String((row as Record<string, unknown>)[c.key] ?? ""))).join(",")
  );

  const csv = [header, ...rows].join("\n");
  const defaultName = filename.endsWith(".csv") ? filename : `${filename}.csv`;

  const path = await save({
    defaultPath: defaultName,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return; // user cancelled

  const encoder = new TextEncoder();
  await writeFile(path, encoder.encode("\uFEFF" + csv));
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
