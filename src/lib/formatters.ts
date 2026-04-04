import { format, parseISO } from "date-fns";

/** Format a number as Philippine Peso currency */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
