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
  default: "border-l-slate-400 dark:border-l-slate-500",
  success: "border-l-emerald-500 dark:border-l-emerald-400",
  warning: "border-l-amber-500 dark:border-l-amber-400",
  danger: "border-l-red-500 dark:border-l-red-400",
};

const iconBgColors: Record<string, string> = {
  default: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300",
  success: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
  warning: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400",
  danger: "bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400",
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
    <Card className={cn("border-l-4", borderColors[resolvedColor], alert && "border-destructive border-l-red-500")}>
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
