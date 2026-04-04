import { formatCurrency } from "@/lib/formatters";

interface KpiCardProps {
  label: string;
  value: string | number;
  type?: "currency" | "number" | "percent";
}

export function KpiCard({ label, value, type }: KpiCardProps) {
  let display: string;
  if (type === "currency" && typeof value === "number") {
    display = formatCurrency(value);
  } else if (type === "percent" && typeof value === "number") {
    display = `${value.toFixed(1)}%`;
  } else {
    display = String(value);
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold tracking-tight">{display}</p>
    </div>
  );
}
