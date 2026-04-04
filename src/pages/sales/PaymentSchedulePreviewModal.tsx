import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { PaymentScheduleEntry } from "@/lib/interest";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PaymentSchedulePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: PaymentScheduleEntry[];
  monthlyPayment: number;
  totalPayable: number;
}

export function PaymentSchedulePreviewModal({
  open,
  onOpenChange,
  schedule,
  monthlyPayment,
  totalPayable,
}: PaymentSchedulePreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Payment Schedule Preview</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between text-sm mb-3">
          <span className="text-muted-foreground">Monthly Payment</span>
          <span className="font-semibold">{formatCurrency(monthlyPayment)}</span>
        </div>

        <ScrollArea className="max-h-[400px]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="text-left py-2 px-2">#</th>
                <th className="text-left py-2 px-2">Due Date</th>
                <th className="text-right py-2 px-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((entry) => (
                <tr key={entry.month_number} className="border-b">
                  <td className="py-2 px-2">{entry.month_number}</td>
                  <td className="py-2 px-2">{formatDate(entry.due_date)}</td>
                  <td className="py-2 px-2 text-right font-medium">
                    {formatCurrency(entry.amount_due)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <td colSpan={2} className="py-2 px-2">Total</td>
                <td className="py-2 px-2 text-right">{formatCurrency(totalPayable)}</td>
              </tr>
            </tfoot>
          </table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
