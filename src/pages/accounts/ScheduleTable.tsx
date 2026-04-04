import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { PaymentScheduleEntry } from "@/types/account";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ScheduleTableProps {
  schedule: PaymentScheduleEntry[];
  onSelectEntry?: (entry: PaymentScheduleEntry) => void;
  selectedId?: number | null;
}

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  partial: "secondary",
  pending: "outline",
  overdue: "destructive",
};

export function ScheduleTable({ schedule, onSelectEntry, selectedId }: ScheduleTableProps) {
  if (schedule.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No schedule entries (open-ended account)
      </p>
    );
  }

  const { format: formatCurrency } = useCurrency();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12">#</TableHead>
          <TableHead>Due Date</TableHead>
          <TableHead className="text-right">Amount Due</TableHead>
          <TableHead className="text-right">Amount Paid</TableHead>
          <TableHead className="text-right">Remaining</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {schedule.map((entry, idx) => {
          const remaining = entry.amount_due - entry.amount_paid;
          const isSelected = selectedId === entry.id;
          return (
            <TableRow
              key={entry.id}
              className={`${onSelectEntry ? "cursor-pointer hover:bg-muted/50" : ""} ${isSelected ? "bg-primary/5" : ""}`}
              onClick={() => onSelectEntry?.(entry)}
            >
              <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
              <TableCell>{formatDate(entry.due_date)}</TableCell>
              <TableCell className="text-right">{formatCurrency(entry.amount_due)}</TableCell>
              <TableCell className="text-right">
                {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {remaining > 0.01 ? formatCurrency(remaining) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={statusVariant[entry.status] ?? "outline"}>
                  {entry.status.toUpperCase()}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
