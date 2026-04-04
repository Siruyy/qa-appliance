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

/** Format a decimal as a percentage, e.g. 0.05 → "5.00%" */
export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}
