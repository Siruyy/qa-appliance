import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
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
import { KpiCard } from "./KpiCard";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { SalesSummaryReport } from "@/types/report";
import { toast } from "sonner";

export function SalesSummaryTab() {
  const { dateFrom, dateTo } = useReportStore();
  const { getSalesSummary } = useReports();
  const [data, setData] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getSalesSummary(dateFrom, dateTo)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Total Sales" value={data.total_sales} type="currency" />
        <KpiCard label="Transactions" value={data.transaction_count} type="number" />
        <KpiCard label="Cash Sales" value={data.cash_total} type="currency" />
        <KpiCard label="Installment Sales" value={data.installment_total} type="currency" />
      </div>

      {/* Chart */}
      {data.daily_totals.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium">Daily Sales Trend</h3>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.daily_totals}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No sales found for this period
                </TableCell>
              </TableRow>
            ) : (
              data.sales.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.sale_date)}</TableCell>
                  <TableCell>{s.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.items_summary}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.total)}</TableCell>
                  <TableCell>
                    <Badge variant={s.payment_type === "cash" ? "default" : "secondary"}>
                      {s.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={s.status === "completed" ? "default" : "destructive"}>
                      {s.status}
                    </Badge>
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
