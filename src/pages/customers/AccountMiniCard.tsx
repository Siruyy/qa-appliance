import type { CustomerAccountSummary } from "@/types/customer";
import { useCurrency } from "@/hooks/useCurrency";
import { Badge } from "@/components/ui/badge";

interface Props {
  account: CustomerAccountSummary;
  onClick?: () => void;
}

const statusColors: Record<string, string> = {
  open: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200",
  defaulted: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200",
};

export function AccountMiniCard({ account, onClick }: Props) {
  const { format: formatCurrency } = useCurrency();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-lg border p-4 text-left transition-colors hover:bg-muted/50"
    >
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">
            {account.items_summary || `Account #${account.id}`}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {`${account.term_months} months — ${formatCurrency(account.monthly_amount ?? 0)}/mo`}
          </p>
        </div>
        <Badge className={statusColors[account.status] ?? "bg-muted text-muted-foreground"}>
          {account.status.toUpperCase()}
        </Badge>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Balance</span>
        <span className="font-semibold tabular-nums">
          {formatCurrency(account.balance_remaining)}
        </span>
      </div>
    </button>
  );
}
