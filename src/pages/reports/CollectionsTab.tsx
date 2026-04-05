import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/KpiCard";
import { Pagination } from "@/components/Pagination";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useClientPagination } from "@/hooks/useClientPagination";
import { formatDate, formatProductSummary } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import type { CollectionsReport } from "@/types/report";
import { toast } from "sonner";

export function CollectionsTab() {
  const { dateFrom, dateTo } = useReportStore();
  const { getCollectionsReport } = useReports();
  const [data, setData] = useState<CollectionsReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    getCollectionsReport(dateFrom, dateTo)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Collected" value={data.total_collected} type="currency" />
        <KpiCard label="Transactions" value={data.transaction_count} type="number" />
        <KpiCard label="Cash Payments" value={data.cash_payments} type="currency" />
        <KpiCard label="Penalty Income" value={data.penalty_total} type="currency" />
      </div>

      {/* Chart */}
      {data.daily_totals.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium">Daily Collections</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.daily_totals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="total" fill="var(--chart-2)" name="Collections" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <PaymentsTable payments={data.payments} formatCurrency={formatCurrency} />
    </div>
  );
}

function PaymentsTable({ payments, formatCurrency }: { payments: CollectionsReport["payments"]; formatCurrency: (v: number) => string }) {
  const { page, setPage, pageSize, total, paginatedItems } = useClientPagination(payments);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No collections found for this period
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDate(p.payment_date)}</TableCell>
                  <TableCell>{p.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{formatProductSummary(p.product_summary)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={p.type === "regular" ? "default" : "secondary"}>
                      {p.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
    </>
  );
}
