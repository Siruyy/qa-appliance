/**
 * Convert an array of objects to CSV and trigger a browser download.
 */
export function downloadCsv<T extends object>(
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
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
