import { memo, useEffect, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartTooltip, gridStyle, axisTickStyle, animationProps } from "@/components/charts";
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
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { paymentTypeVariant, saleStatusVariant } from "@/lib/badgeVariants";
import type { SalesSummaryReport } from "@/types/report";
import { TableSkeleton } from "@/components/TableSkeleton";
import { toast } from "sonner";
import { extractErrorMessage } from '@/lib/error';

export function SalesSummaryTab() {
  const { dateFrom, dateTo } = useReportStore();
  const { getSalesSummary } = useReports();
  const [data, setData] = useState<SalesSummaryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    getSalesSummary(dateFrom, dateTo)
      .then(setData)
      .catch((e) => toast.error(extractErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo, getSalesSummary]);

  if (loading) return <Table><TableSkeleton cols={6} /></Table>;
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        <KpiCard label="Discounts Given" value={data.discount_total} type="currency" />
        <KpiCard label="Voided Sales" value={data.voided_count} type="number" />
        <KpiCard label="Voided Amount" value={data.voided_total} type="currency" />
      </div>

      {/* Chart */}
      {data.daily_totals.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium" style={{ fontFamily: "var(--font-heading)" }}>Daily Sales Trend</h3>
          <p className="mb-3 text-xs text-muted-foreground">Revenue by day for the selected period</p>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.daily_totals} {...animationProps}>
              <defs>
                <linearGradient id="salesSummaryGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} vertical={false} />
              <XAxis dataKey="date" tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisTickStyle} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                content={
                  <ChartTooltip
                    labelFormatter={(l) => formatDate(String(l))}
                    valueFormatter={(v) => formatCurrency(v)}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Sales"
                stroke="var(--chart-1)"
                strokeWidth={2}
                fill="url(#salesSummaryGradient)"
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <SalesTable sales={data.sales} formatCurrency={formatCurrency} />
    </div>
  );
}

const SalesTable = memo(function SalesTable({ sales, formatCurrency }: { sales: SalesSummaryReport["sales"]; formatCurrency: (v: number) => string }) {
  const { page, setPage, pageSize, total, paginatedItems } = useClientPagination(sales);

  return (
    <>
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
            {sales.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No sales found for this period
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>{formatDate(s.sale_date)}</TableCell>
                  <TableCell>{s.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{s.items_summary}</TableCell>
                  <TableCell className="text-right">{formatCurrency(s.total)}</TableCell>
                  <TableCell>
                    <Badge variant={paymentTypeVariant[s.payment_type] ?? "secondary"}>
                      {s.payment_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={saleStatusVariant[s.status] ?? "default"}>
                      {s.status}
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
});