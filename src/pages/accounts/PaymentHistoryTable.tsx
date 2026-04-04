import { formatCurrency, formatDate } from "@/lib/formatters";
import type { AccountPayment } from "@/types/account";
import { Badge } from "@/components/ui/badge";
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
}

const typeLabels: Record<string, string> = {
  payment: "Payment",
  down_payment: "Down Payment",
  penalty: "Penalty",
  interest_adjustment: "Interest Adj.",
};

const typeVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  payment: "default",
  down_payment: "secondary",
  penalty: "destructive",
  interest_adjustment: "outline",
};

export function PaymentHistoryTable({ payments }: PaymentHistoryTableProps) {
  if (payments.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No payments recorded yet
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {payments.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{formatDate(p.payment_date)}</TableCell>
            <TableCell className={`text-right font-medium ${p.type === "penalty" ? "text-destructive" : ""}`}>
              {p.type === "penalty" ? "+" : "−"}{formatCurrency(p.amount)}
            </TableCell>
            <TableCell>
              <Badge variant={typeVariant[p.type] ?? "outline"}>
                {typeLabels[p.type] ?? p.type}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground max-w-[200px] truncate">
              {p.notes ?? "—"}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
