import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { PaymentScheduleEntry } from "@/types/account";
import { scheduleStatusVariant } from "@/lib/badgeVariants";
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
  totalPenalties?: number;
  interestPerMonth?: number;
  principalPerMonth?: number;
}

export function ScheduleTable({ schedule, onSelectEntry, selectedId, totalPenalties, interestPerMonth, principalPerMonth }: ScheduleTableProps) {
  if (schedule.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No schedule entries
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
              <TableCell className="text-right">
                <span>{formatCurrency(entry.amount_due)}</span>
                {principalPerMonth != null && principalPerMonth > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    {formatCurrency(principalPerMonth)} + {formatCurrency(interestPerMonth ?? 0)} int.
                  </span>
                )}
              </TableCell>
              <TableCell className="text-right">
                {entry.amount_paid > 0 ? formatCurrency(entry.amount_paid) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {remaining > 0.01 ? formatCurrency(remaining) : "—"}
              </TableCell>
              <TableCell>
                <Badge variant={scheduleStatusVariant[entry.status] ?? "outline"}>
                  {entry.status.toUpperCase()}
                </Badge>
              </TableCell>
            </TableRow>
          );
        })}
        {totalPenalties != null && totalPenalties > 0 && (
          <TableRow className="bg-destructive/5 font-medium">
            <TableCell colSpan={2} className="text-destructive">
              Total Penalties Applied
            </TableCell>
            <TableCell className="text-right text-destructive">
              {formatCurrency(totalPenalties)}
            </TableCell>
            <TableCell colSpan={3} />
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
