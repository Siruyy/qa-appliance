import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";

import { usePayments } from "@/hooks/usePayments";
import { recordPaymentSchema, type RecordPaymentValues } from "@/lib/validations/payment";
import { useCurrency } from "@/hooks/useCurrency";
import { formatProductSummary } from "@/lib/formatters";
import type { AccountDetail, PaymentScheduleEntry } from "@/types/account";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { ScheduleTable } from "./ScheduleTable";

interface RecordPaymentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountDetail;
  onSuccess: () => void;
}

export function RecordPaymentModal({
  open,
  onOpenChange,
  account,
  onSuccess,
}: RecordPaymentModalProps) {
  const { recordPayment } = usePayments();
  const { format: formatCurrency } = useCurrency();
  const [submitting, setSubmitting] = useState(false);
  const [selectedScheduleEntry, setSelectedScheduleEntry] = useState<PaymentScheduleEntry | null>(
    null
  );
  const [applyMode, setApplyMode] = useState<"auto" | "specific">("auto");

  const today = new Date().toISOString().split("T")[0];

  const form = useForm<RecordPaymentValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      account_id: account.id,
      amount: 0,
      payment_date: today,
      schedule_id: null,
      notes: null,
    },
  });

  const handleApplyModeChange = (value: string | null) => {
    if (!value) return;
    setApplyMode(value as "auto" | "specific");
    if (value === "auto") {
      setSelectedScheduleEntry(null);
      form.setValue("schedule_id", null);
    }
  };

  const handleScheduleSelect = (entry: PaymentScheduleEntry) => {
    setSelectedScheduleEntry(entry);
    form.setValue("schedule_id", entry.id);
    // Suggest the remaining amount for this entry
    const remaining = entry.amount_due - entry.amount_paid;
    if (remaining > 0) {
      form.setValue("amount", Math.round(remaining * 100) / 100);
    }
  };

  const onSubmit = async (values: RecordPaymentValues) => {
    setSubmitting(true);
    try {
      await recordPayment({
        account_id: values.account_id,
        schedule_id: applyMode === "specific" ? values.schedule_id : null,
        amount: values.amount,
        payment_date: values.payment_date,
        notes: values.notes,
      });
      toast.success(`Payment of ${formatCurrency(values.amount)} recorded`);
      onOpenChange(false);
      form.reset({
        account_id: account.id,
        amount: 0,
        payment_date: today,
        schedule_id: null,
        notes: null,
      });
      setSelectedScheduleEntry(null);
      setApplyMode("auto");
      onSuccess();
    } catch (err) {
      toast.error(String(err));
    } finally {
      setSubmitting(false);
    }
  };

  const overdueEntries = account.schedule.filter(
    (e) => e.status === "overdue" || e.status === "partial"
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Payment</DialogTitle>
        </DialogHeader>

        <div className="rounded-lg border p-3 bg-muted/30 text-sm">
          <p className="font-medium">
            {account.customer_name} — {formatProductSummary(account.product_summary)}
          </p>
          <p className="text-muted-foreground">
            Balance: {formatCurrency(account.balance_remaining)}
          </p>
        </div>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Payment Date</Label>
              <Input type="date" max={today} {...form.register("payment_date")} />
              {form.formState.errors.payment_date && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.payment_date.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Amount (₱)</Label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                max={account.balance_remaining}
                {...form.register("amount", { valueAsNumber: true })}
              />
              {form.formState.errors.amount && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.amount.message}
                </p>
              )}
            </div>
          </div>

          {account.has_schedule && overdueEntries.length > 0 && (
            <div className="space-y-2">
              <Label>Apply to</Label>
              <Select value={applyMode} onValueChange={handleApplyModeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Earliest overdue entry (auto)</SelectItem>
                  <SelectItem value="specific">Specific schedule entry</SelectItem>
                </SelectContent>
              </Select>

              {applyMode === "specific" && (
                <div className="rounded-md border max-h-48 overflow-auto">
                  <ScheduleTable
                    schedule={account.schedule.filter(
                      (e) => e.status !== "paid"
                    )}
                    onSelectEntry={handleScheduleSelect}
                    selectedId={selectedScheduleEntry?.id}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Payment notes..."
              {...form.register("notes")}
              rows={2}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Recording..." : "Record Payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
