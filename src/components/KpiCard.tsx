import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ElementType } from "react";

export interface KpiCardProps {
  title?: string;
  label?: string;
  value: string | number;
  sub?: string;
  description?: string;
  type?: "currency" | "number" | "percent";
  alert?: boolean;
  icon?: ElementType;
  color?: "default" | "success" | "warning" | "danger";
}

const borderColors: Record<string, string> = {
  default: "border-l-[var(--primary)]",
  success: "border-l-[var(--success)]",
  warning: "border-l-[var(--warning)]",
  danger: "border-l-[var(--danger)]",
};

const iconBgColors: Record<string, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-[var(--success-bg)] text-[var(--success)]",
  warning: "bg-[var(--warning-bg)] text-[var(--warning)]",
  danger: "bg-[var(--danger-bg)] text-[var(--danger)]",
};

export function KpiCard({ title, label, value, sub, description, type, alert, icon: Icon, color }: KpiCardProps) {
  const { format: formatCurrency } = useCurrency();
  const heading = title ?? label ?? "";
  const resolvedColor = color ?? (alert ? "danger" : "default");

  let display: string;
  if (type === "currency" && typeof value === "number") {
    display = formatCurrency(value);
  } else if (type === "percent" && typeof value === "number") {
    display = `${value.toFixed(1)}%`;
  } else {
    display = String(value);
  }

  const subText = sub ?? description;

  return (
    <Card className={cn("border-l-4", borderColors[resolvedColor], alert && "border-destructive border-l-[var(--danger)]")}>
      <CardContent className="flex items-start gap-3 pt-4 pb-4">
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconBgColors[resolvedColor])}>
            <Icon className="h-4 w-4" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{heading}</p>
          <p className="text-xl font-semibold tracking-tight truncate mt-0.5" style={{ fontFamily: "var(--font-heading)" }} title={display}>{display}</p>
          {subText && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
