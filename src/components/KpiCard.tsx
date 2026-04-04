import { useCurrency } from "@/hooks/useCurrency";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  title?: string;
  label?: string;
  value: string | number;
  sub?: string;
  description?: string;
  type?: "currency" | "number" | "percent";
  alert?: boolean;
}

export function KpiCard({ title, label, value, sub, description, type, alert }: KpiCardProps) {
  const { format: formatCurrency } = useCurrency();
  const heading = title ?? label ?? "";

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
    <Card className={cn(alert && "border-destructive")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{heading}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold tracking-tight">{display}</p>
        {subText && <p className="text-xs text-muted-foreground mt-1">{subText}</p>}
      </CardContent>
    </Card>
  );
}
