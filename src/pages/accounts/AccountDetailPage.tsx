import { extractErrorMessage } from "@/lib/error";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, CreditCard, XCircle, NotebookPen, RefreshCw, FileText, FileSpreadsheet, Settings2, Pencil } from "lucide-react";
import { toast } from "sonner";

import { useAccounts } from "@/hooks/useAccounts";
import type { AccountDetail } from "@/types/account";
import { formatDate, formatProductSummary } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { accountStatusVariant } from "@/lib/badgeVariants";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { HelpTip } from "@/components/help/HelpTip";
import { useSettingsStore } from "@/stores/settingsStore";
import { toInstallmentPlan, toStatementOfAccount } from "@/lib/export";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

import { Skeleton } from "@/components/ui/skeleton";
import { ScheduleTable } from "./ScheduleTable";
import { PaymentHistoryTable } from "./PaymentHistoryTable";
import { RecordPaymentModal } from "./RecordPaymentModal";

export function AccountDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { getAccountById, markAccountDefaulted, updateAccountNotes, recalculateBalance, voidPayment, waivePenalty, updateAccountRebateAmount, restructureAccount } = useAccounts();
  const { format: formatCurrency } = useCurrency();
  const settings = useSettingsStore((s) => s.settings);

  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDefaultConfirm, setShowDefaultConfirm] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [recalculating, setRecalculating] = useState(false);
  const [exportingPlan, setExportingPlan] = useState(false);
  const [exportingSoa, setExportingSoa] = useState(false);

  // Void payment state
  const [voidingPaymentId, setVoidingPaymentId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState("");

  // Waive penalty state
  const [waivingPenaltyId, setWaivingPenaltyId] = useState<number | null>(null);
  const [waiveReason, setWaiveReason] = useState("");

  // Rebate rate edit state
  const [editingRebate, setEditingRebate] = useState(false);
  const [rebateRate, setRebateRate] = useState("");

  // Restructure state
  const [showRestructure, setShowRestructure] = useState(false);
  const [restructureTerm, setRestructureTerm] = useState("");
  const [restructureRate, setRestructureRate] = useState("");

  const loadAccount = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await getAccountById(Number(id));
      setAccount(detail);
      setNotes(detail.notes ?? "");
    } catch (err) {
      toast.error(extractErrorMessage(err));
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
      toast.success(`Balance recalculated: ${formatCurrency(newBalance)}`);
      await loadAccount();
    } catch (err) {
      toast.error(`Recalculate failed: ${extractErrorMessage(err)}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handlePrintPlan = async () => {
    if (!account) return;
    setExportingPlan(true);
    try {
      await toInstallmentPlan(account, {
        name: settings.store_name,
        address: settings.store_address,
        phone: settings.store_phone,
      });
      toast.success("Installment plan saved as PDF");
    } catch (err) {
      toast.error(`Export failed: ${extractErrorMessage(err)}`);
    } finally {
      setExportingPlan(false);
    }
  };

  const handleExportSoa = async () => {
    if (!account) return;
    setExportingSoa(true);
    try {
      await toStatementOfAccount(account, {
        name: settings.store_name,
        address: settings.store_address,
        phone: settings.store_phone,
      });
      toast.success("Statement of account saved as PDF");
    } catch (err) {
      toast.error(`Export failed: ${extractErrorMessage(err)}`);
    } finally {
      setExportingSoa(false);
    }
  };

  const handleDefault = async () => {
    if (!account) return;
    try {
      await markAccountDefaulted(account.id);
      toast.success("Account marked as defaulted");
      await loadAccount();
    } catch (err) {
      toast.error(extractErrorMessage(err));
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
      toast.error(extractErrorMessage(err));
    }
  };

  const handleVoidPayment = async () => {
    if (voidingPaymentId === null) return;
    try {
      await voidPayment(voidingPaymentId, voidReason || "Voided by staff");
      toast.success("Payment voided successfully");
      setVoidingPaymentId(null);
      setVoidReason("");
      await loadAccount();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleWaivePenalty = async () => {
    if (waivingPenaltyId === null) return;
    try {
      await waivePenalty(waivingPenaltyId, waiveReason || "Waived by staff");
      toast.success("Penalty waived successfully");
      setWaivingPenaltyId(null);
      setWaiveReason("");
      await loadAccount();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleSaveRebateAmount = async () => {
    if (!account) return;
    const amount = parseFloat(rebateRate);
    if (isNaN(amount) || amount < 0) {
      toast.error("Rebate amount must be 0 or greater");
      return;
    }
    try {
      await updateAccountRebateAmount(account.id, amount);
      toast.success(`Rebate amount updated to ₱${amount.toFixed(2)}`);
      setEditingRebate(false);
      await loadAccount();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const handleRestructure = async () => {
    if (!account) return;
    const term = parseInt(restructureTerm);
    const rate = parseFloat(restructureRate);
    if (isNaN(term) || term < 1) {
      toast.error("Term must be at least 1 month");
      return;
    }
    if (isNaN(rate) || rate < 0) {
      toast.error("Interest rate must be 0 or higher");
      return;
    }
    try {
      await restructureAccount(account.id, term, rate);
      toast.success("Account restructured successfully");
      setShowRestructure(false);
      setRestructureTerm("");
      setRestructureRate("");
      await loadAccount();
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrintPlan}
            disabled={exportingPlan}
            title="Save installment plan as PDF"
          >
            <FileText className={`mr-2 h-4 w-4 ${exportingPlan ? "animate-pulse" : ""}`} />
            {exportingPlan ? "Saving…" : "Print Plan"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportSoa}
            disabled={exportingSoa}
            title="Export statement of account as PDF"
          >
            <FileSpreadsheet className={`mr-2 h-4 w-4 ${exportingSoa ? "animate-pulse" : ""}`} />
            {exportingSoa ? "Saving…" : "Export SOA"}
          </Button>
          {account.status === "open" && (
            <>
              <Button onClick={() => setShowPaymentModal(true)}>
                <CreditCard className="mr-2 h-4 w-4" /> Record Payment
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRestructureTerm(String(account.term_months));
                  setRestructureRate(String(account.interest_rate));
                  setShowRestructure(true);
                }}
              >
                <Settings2 className="mr-2 h-4 w-4" /> Restructure
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
          <p className="text-xs text-muted-foreground">Balance Remaining <HelpTip text="Running balance decremented by each payment. Use 'Recalculate' if it seems incorrect." /></p>
          <p className="text-lg font-semibold text-primary">
            {formatCurrency(account.balance_remaining)}
          </p>
        </div>
        {account.rebate_credited > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Rebate</p>
            <p className="text-lg font-semibold text-green-600">
              {formatCurrency(account.rebate_credited)}
            </p>
          </div>
        )}
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
          <p className="text-sm font-medium">
            {account.interest_rate}%
            {account.interest_type === "annual"
              ? "/yr"
              : account.interest_type === "flat_total"
                ? " flat"
                : "/mo"}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Penalty Rate</p>
          <p className="text-sm font-medium">{account.penalty_rate}%</p>
        </div>
        {account.status === "open" ? (
          <div>
            <p className="text-xs text-muted-foreground">Rebate Amount</p>
            {editingRebate ? (
              <div className="flex items-center gap-1 mt-1">
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={rebateRate}
                  onChange={(e) => setRebateRate(e.target.value)}
                  className="h-7 w-20 text-sm"
                />
                <span className="text-xs">₱</span>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={handleSaveRebateAmount}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setEditingRebate(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <p className="text-sm font-medium text-green-600">₱{(account.rebate_amount ?? 0).toFixed(2)}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 w-5 p-0"
                  onClick={() => {
                    setRebateRate(String(account.rebate_amount ?? 0));
                    setEditingRebate(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>
        ) : (account.rebate_amount ?? 0) > 0 ? (
          <div>
            <p className="text-xs text-muted-foreground">Rebate Amount</p>
            <p className="text-sm font-medium text-green-600">₱{account.rebate_amount.toFixed(2)}</p>
          </div>
        ) : null}
        <div>
          <p className="text-xs text-muted-foreground">Type</p>
          <p className="text-sm font-medium">
            {`Installment (${account.term_months} months)`}
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
        <div>
          <h2 className="text-lg font-semibold mb-3">Payment Schedule <HelpTip text="Fixed monthly payments with due dates. Green = paid, red = overdue." /></h2>
          <div className="rounded-md border">
            <ScheduleTable
              schedule={account.schedule}
              totalPenalties={account.payments
                .filter((p) => p.type === "penalty" && !p.is_reversed)
                .reduce((sum, p) => sum + p.amount, 0)}
              principalPerMonth={
                account.term_months && account.term_months > 0
                  ? Math.round((account.principal / account.term_months) * 100) / 100
                  : undefined
              }
              interestPerMonth={
                account.term_months && account.term_months > 0 && account.monthly_amount
                  ? Math.round((account.monthly_amount - account.principal / account.term_months) * 100) / 100
                  : undefined
              }
            />
          </div>
        </div>

      <Separator />

      {/* Payment History */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Payment History</h2>
        <div className="rounded-md border">
          <PaymentHistoryTable
            payments={account.payments}
            accountStatus={account.status}
            onVoidPayment={(paymentId) => {
              setVoidingPaymentId(paymentId);
              setVoidReason("");
            }}
            onWaivePenalty={(penaltyId) => {
              setWaivingPenaltyId(penaltyId);
              setWaiveReason("");
            }}
          />
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

      {/* Void Payment Dialog */}
      <Dialog open={voidingPaymentId !== null} onOpenChange={(open) => { if (!open) setVoidingPaymentId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Void Payment</DialogTitle>
            <DialogDescription>
              This will reverse the payment and restore the balance. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="void-reason">Reason for voiding</Label>
              <Textarea
                id="void-reason"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                placeholder="e.g., Customer overpayment, incorrect amount..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setVoidingPaymentId(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleVoidPayment}>
              Void Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Waive Penalty Dialog */}
      <Dialog open={waivingPenaltyId !== null} onOpenChange={(open) => { if (!open) setWaivingPenaltyId(null); }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Waive Penalty</DialogTitle>
            <DialogDescription>
              This will reverse the penalty charge and reduce the account balance accordingly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2">
              <Label htmlFor="waive-reason">Reason for waiving</Label>
              <Textarea
                id="waive-reason"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g., Customer goodwill, first-time late..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaivingPenaltyId(null)}>Cancel</Button>
            <Button variant="default" onClick={handleWaivePenalty}>
              Waive Penalty
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Restructure Account Dialog */}
      <Dialog open={showRestructure} onOpenChange={setShowRestructure}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Restructure Account</DialogTitle>
            <DialogDescription>
              Recalculate interest on the remaining balance ({formatCurrency(account.balance_remaining)}) with a new term and rate. 
              Unpaid schedule entries will be replaced with new ones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="restructure-term">New Term (months)</Label>
              <Input
                id="restructure-term"
                type="number"
                min="1"
                max="60"
                value={restructureTerm}
                onChange={(e) => setRestructureTerm(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="restructure-rate">New Monthly Interest Rate (%)</Label>
              <Input
                id="restructure-rate"
                type="number"
                min="0"
                max="20"
                step="0.1"
                value={restructureRate}
                onChange={(e) => setRestructureRate(e.target.value)}
              />
            </div>
            {restructureTerm && restructureRate && !isNaN(parseFloat(restructureRate)) && !isNaN(parseInt(restructureTerm)) && parseInt(restructureTerm) > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p className="font-medium">Preview</p>
                <p>Remaining balance: {formatCurrency(account.balance_remaining)}</p>
                <p>New interest: {formatCurrency(account.balance_remaining * (parseFloat(restructureRate) / 100) * parseInt(restructureTerm))}</p>
                <p>New total: {formatCurrency(account.balance_remaining + account.balance_remaining * (parseFloat(restructureRate) / 100) * parseInt(restructureTerm))}</p>
                <p>New monthly: {formatCurrency((account.balance_remaining + account.balance_remaining * (parseFloat(restructureRate) / 100) * parseInt(restructureTerm)) / parseInt(restructureTerm))}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRestructure(false)}>Cancel</Button>
            <Button onClick={handleRestructure}>
              Restructure Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
