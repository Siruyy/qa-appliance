import { format, parseISO } from "date-fns";

/**
 * Format a number as currency using the given symbol.
 * Falls back to "₱" if no symbol is provided.
 */
export function formatCurrency(amount: number, symbol = "₱"): string {
  const formatted = new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `${symbol}${formatted}`;
}

/** Format an ISO date string to "MMM d, yyyy" */
export function formatDate(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy");
}

/** Format an ISO date-time string to "MMM d, yyyy h:mm a" */
export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "MMM d, yyyy h:mm a");
}

/**
 * Format a whole-number percentage, e.g. 5 → "5.00%"
 * The value is already in percentage form (not decimal).
 */
export function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Format a product summary that may contain raw JSON attributes.
 * e.g. 'Condura Refrigerator {"color":"White","size":"5 cu ft"}'
 *   → 'Condura Refrigerator — White, 5 cu ft'
 */
export function formatProductSummary(summary: string): string {
  const jsonStart = summary.indexOf("{");
  if (jsonStart === -1) return summary;

  const name = summary.slice(0, jsonStart).trim();
  const jsonStr = summary.slice(jsonStart);

  try {
    const attrs = JSON.parse(jsonStr) as Record<string, string>;
    const values = Object.values(attrs).filter(Boolean).join(", ");
    return values ? `${name} — ${values}` : name;
  } catch {
    return summary;
  }
}

/**
 * Format a JSON attributes string into a readable label.
 * e.g. '{"color":"White","size":"5 cu ft"}' → 'White, 5 cu ft'
 */
export function formatAttributes(json: string | null | undefined): string {
  if (!json) return "";
  try {
    const attrs = JSON.parse(json) as Record<string, string>;
    return Object.values(attrs).filter(Boolean).join(", ");
  } catch {
    return json;
  }
}

/**
 * Format a variant_label like "SKU - {json}" into "SKU - White, 5 cu ft".
 * If the label has no JSON portion, returns it as-is.
 */
export function formatVariantLabel(label: string | null | undefined): string {
  if (!label) return "";
  const idx = label.indexOf(" - {");
  if (idx === -1) return label;
  const sku = label.slice(0, idx);
  const json = label.slice(idx + 3);
  const parsed = formatAttributes(json);
  return parsed ? `${sku} - ${parsed}` : sku;
}
