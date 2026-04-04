import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Search } from "lucide-react";

import { usePayments } from "@/hooks/usePayments";
import { usePaymentStore } from "@/stores/paymentStore";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const typeColor: Record<string, string> = {
  payment: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  down_payment: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  penalty: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  interest_adjustment: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

export function PaymentsPage() {
  const navigate = useNavigate();
  const { fetchPayments } = usePayments();
  const {
    loading,
    search,
    dateFrom,
    dateTo,
    setSearch,
    setDateFrom,
    setDateTo,
    filteredPayments,
    totalShown,
  } = usePaymentStore();

  useEffect(() => {
    fetchPayments(dateFrom || undefined, dateTo || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  const payments = filteredPayments();
  const total = totalShown();

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Payment History</h1>
          <p className="text-sm text-muted-foreground">All recorded payments across accounts</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customer or product..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-[160px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm text-muted-foreground">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-[160px]"
          />
        </div>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-6 text-sm">
        <span className="text-muted-foreground">
          {payments.length} payment{payments.length !== 1 ? "s" : ""}
        </span>
        <span className="font-medium">Total: {formatCurrency(total)}</span>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-accent/50"
                  onClick={() => navigate(`/accounts/${p.account_id}`)}
                >
                  <TableCell className="whitespace-nowrap">{formatDate(p.payment_date)}</TableCell>
                  <TableCell>{p.customer_name}</TableCell>
                  <TableCell className="max-w-[180px] truncate">{p.product_summary}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={typeColor[p.type] ?? ""}>
                      {p.type.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatCurrency(p.amount)}
                  </TableCell>
                  <TableCell className="max-w-[160px] truncate text-muted-foreground">
                    {p.notes ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
