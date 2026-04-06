import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { AccountPayment } from "@/types/account";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Undo2, ShieldOff } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface PaymentHistoryTableProps {
  payments: AccountPayment[];
  accountStatus?: string;
  onVoidPayment?: (paymentId: number) => void;
  onWaivePenalty?: (paymentId: number) => void;
}

const typeLabels: Record<string, string> = {
  payment: "Payment",
  down_payment: "Down Payment",
  penalty: "Penalty",
  interest_adjustment: "Interest Adj.",
  rebate: "Rebate",
};

const typeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  payment: "default",
  down_payment: "secondary",
  penalty: "destructive",
  interest_adjustment: "outline",
  rebate: "outline",
};

export function PaymentHistoryTable({
  payments,
  accountStatus,
  onVoidPayment,
  onWaivePenalty,
}: PaymentHistoryTableProps) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No payments recorded yet
      </p>
    );
  }

  const isOpen = accountStatus === "open";
  const { format: formatCurrency } = useCurrency();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Notes</TableHead>
          <TableHead>Status</TableHead>
          {isOpen && (onVoidPayment || onWaivePenalty) && (
            <TableHead className="w-[80px]">Actions</TableHead>
          )}
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow
            key={p.id}
            className={p.is_reversed ? "opacity-50" : ""}
          >
            <TableCell>{formatDate(p.payment_date)}</TableCell>
            <TableCell
              className={`text-right font-medium tabular-nums ${
                p.is_reversed
                  ? "line-through text-muted-foreground"
                  : p.type === "penalty"
                  ? "text-destructive"
                  : p.type === "rebate"
                  ? "text-green-600"
                  : ""
              }`}
            >
              {p.type === "penalty" ? "+" : "−"}
              {formatCurrency(Math.abs(p.amount))}
            </TableCell>
            <TableCell>
              <Badge variant={p.is_reversed ? "outline" : (typeVariant[p.type] ?? "outline")}>
                {typeLabels[p.type] ?? p.type}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[200px] truncate">
              {p.is_reversed && p.reversed_reason
                ? `Reversed: ${p.reversed_reason}`
                : (p.notes ?? "—")}
            </TableCell>
            <TableCell>
              {p.is_reversed ? (
                <Badge variant="outline" className="text-amber-600 border-amber-300">
                  Reversed
                </Badge>
              ) : (
                <Badge variant="outline" className="text-green-600 border-green-300">
                  Active
                </Badge>
              )}
            </TableCell>
            {isOpen && (onVoidPayment || onWaivePenalty) && (
              <TableCell>
                {!p.is_reversed && p.type === "payment" && onVoidPayment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-600 hover:text-amber-700"
                    onClick={() => onVoidPayment(p.id)}
                    title="Void this payment"
                  >
                    <Undo2 className="h-4 w-4" />
                  </Button>
                )}
                {!p.is_reversed && p.type === "penalty" && onWaivePenalty && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-amber-600 hover:text-amber-700"
                    onClick={() => onWaivePenalty(p.id)}
                    title="Waive this penalty"
                  >
                    <ShieldOff className="h-4 w-4" />
                  </Button>
                )}
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
