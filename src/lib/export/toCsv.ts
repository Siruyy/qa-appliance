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

export function toCsv({ filename, headers, rows }: CsvExportOptions) {
  const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ];

  const blob = new Blob([bom + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
