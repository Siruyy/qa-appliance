import { Badge } from "@/components/ui/badge";
import {
  accountStatusVariant,
  scheduleStatusVariant,
  saleStatusVariant,
  paymentTypeVariant,
  collectionTypeVariant,
  stockStatusVariant,
} from "@/lib/badgeVariants";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const variantMaps = {
  account: accountStatusVariant,
  schedule: scheduleStatusVariant,
  sale: saleStatusVariant,
  paymentType: paymentTypeVariant,
  collection: collectionTypeVariant,
  stock: stockStatusVariant,
} as const;

type StatusType = keyof typeof variantMaps;

interface StatusBadgeProps {
  type: StatusType;
  value: string;
  label?: string;
  className?: string;
}

/**
 * Single source of truth for status badges (STY-01 / STY-02).
 * Usage: <StatusBadge type="account" value="open" />
 */
export function StatusBadge({ type, value, label, className }: StatusBadgeProps) {
  const map = variantMaps[type] as Record<string, BadgeVariant>;
  const variant = map[value.toLowerCase().replace(/ /g, "_")] ?? "outline";
  const displayLabel = label ?? value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <Badge variant={variant} className={className}>
      {displayLabel}
    </Badge>
  );
}
