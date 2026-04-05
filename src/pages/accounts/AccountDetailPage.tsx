import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, XCircle, NotebookPen, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { useAccounts } from "@/hooks/useAccounts";
import type { AccountDetail } from "@/types/account";
import { formatDate, formatProductSummary } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { accountStatusVariant } from "@/lib/badgeVariants";
import { Breadcrumbs } from "@/components/Breadcrumbs";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { ScheduleTable } from "./ScheduleTable";
import { PaymentHistoryTable } from "./PaymentHistoryTable";
import { RecordPaymentModal } from "./RecordPaymentModal";

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAccountById, markAccountDefaulted, updateAccountNotes, recalculateBalance } = useAccounts();
  const { format: formatCurrency } = useCurrency();

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [recalculating, setRecalculating] = useState(false);

  const loadAccount = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await getAccountById(Number(id));
      setAccount(detail);
      setNotes(detail.notes ?? "");
    } catch (err) {
      toast.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [id, getAccountById]);

  useEffect(() => {
    loadAccount();
  }, [loadAccount]);

  useEffect(() => {
    const action = searchParams.get("action");
    if (action === "pay" && account) {
      setShowPaymentModal(true);
    } else if (action === "default" && account) {
      setShowDefaultConfirm(true);
    }
  }, [searchParams, account]);

  const handleRecalculate = async () => {
    if (!account) return;
    setRecalculating(true);
    try {
      const newBalance = await recalculateBalance(account.id);
      toast.success(`Balance recalculated: ${newBalance.toFixed(2)}`);
      await loadAccount();
    } catch (err) {
      toast.error(`Recalculate failed: ${String(err)}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleDefault = async () => {
    if (!account) return;
    try {
      await markAccountDefaulted(account.id);
      toast.success("Account marked as defaulted");
      await loadAccount();
    } catch (err) {
      toast.error(String(err));
    }
    setShowDefaultConfirm(false);
  };

  const handleSaveNotes = async () => {
    if (!account) return;
    try {
      await updateAccountNotes(account.id, notes);
      toast.success("Notes updated");
      setEditingNotes(false);
      await loadAccount();
    } catch (err) {
      toast.error(String(err));
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16 text-muted-foreground">Loading account...</div>
    );
  }

  if (!account) {
    return (
      <div className="text-center py-16 text-muted-foreground">Account not found</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumbs */}
      <Breadcrumbs items={[
        { label: "Accounts", to: "/accounts" },
        { label: `Account #${account.id}` },
      ]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/accounts")} aria-label="Back to accounts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {account.customer_name} — {formatProductSummary(account.product_summary)}
            </h1>
            <p className="text-sm text-muted-foreground">
              Account #{account.id} · Sale #{account.sale_id}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {account.status === "open" && (
            <>
              <Button onClick={() => setShowPaymentModal(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Record Payment
              </Button>
              <Button variant="destructive" onClick={() => setShowDefaultConfirm(true)}>
                <XCircle className="mr-2 h-4 w-4" /> Mark Defaulted
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRecalculate}
            disabled={recalculating}
            title="Recalculate balance from payment history"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${recalculating ? "animate-spin" : ""}`} />
            {recalculating ? "Recalculating..." : "Recalculate Balance"}
          </Button>
        </div>
      </div>

      {/* Account Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-lg border p-4">
        <div>
          <p className="text-xs text-muted-foreground">Principal</p>
          <p className="text-lg font-semibold">{formatCurrency(account.principal)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Down Payment</p>
          <p className="text-lg font-semibold">{formatCurrency(account.down_payment)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Balance Remaining</p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(account.balance_remaining)}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Status</p>
          <Badge
            variant={account.is_overdue ? "destructive" : accountStatusVariant[account.status] ?? "outline"}
            className="mt-1"
          >
            {account.is_overdue ? "OVERDUE" : account.status.toUpperCase()}
          </Badge>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Interest Rate</p>
          <p className="text-sm font-medium">{account.interest_rate}%/mo</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Penalty Rate</p>
          <p className="text-sm font-medium">{account.penalty_rate}%</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="text-sm font-medium">
            {account.has_schedule
              ? `Installment (${account.term_months} months)`
              : "Utang (open-ended)"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Start Date</p>
          <p className="text-sm font-medium">
            {account.start_date ? formatDate(account.start_date) : "—"}
          </p>
        </div>
      </div>

      {/* Notes */}
      <div className="rounded-lg border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold">Notes</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (editingNotes) handleSaveNotes();
              else setEditingNotes(true);
            }}
          >
            <NotebookPen className="mr-1 h-3 w-3" />
            {editingNotes ? "Save" : "Edit"}
          </Button>
        </div>
        {editingNotes ? (
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes..."
            rows={3}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            {account.notes || "No notes"}
          </p>
        )}
      </div>

      <Separator />

      {/* Payment Schedule */}
      {account.has_schedule && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Payment Schedule</h2>
          <div className="rounded-md border">
            <ScheduleTable schedule={account.schedule} />
          </div>
        </div>
      )}

      <Separator />

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Payment History</h2>
        <div className="rounded-md border">
          <PaymentHistoryTable payments={account.payments} />
        </div>
      </div>

      {/* Record Payment Modal */}
      <RecordPaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        account={account}
        onSuccess={loadAccount}
      />

      {/* Default Confirmation */}
      <AlertDialog open={showDefaultConfirm} onOpenChange={setShowDefaultConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark Account as Defaulted?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the account for {account.customer_name} — {formatProductSummary(account.product_summary)} as
              defaulted. This action indicates the customer is unlikely to pay the remaining balance
              of {formatCurrency(account.balance_remaining)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDefault} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Mark Defaulted
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
