import { memo, useEffect, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
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
import { ChartTooltip, animationProps } from "@/components/charts";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useCurrency } from "@/hooks/useCurrency";
import { accountStatusVariant } from "@/lib/badgeVariants";
import { formatProductSummary } from "@/lib/formatters";
import type { ReceivablesReport } from "@/types/report";
import { toast } from "sonner";

const PIE_COLORS = ["var(--chart-1)", "var(--chart-3)", "var(--chart-4)", "var(--chart-2)", "var(--chart-5)"];

export function ReceivablesTab() {
  const { statusFilter } = useReportStore();
  const { getReceivablesReport } = useReports();
  const [data, setData] = useState<ReceivablesReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    getReceivablesReport(statusFilter === "all" ? undefined : statusFilter)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Outstanding" value={data.total_outstanding} type="currency" />
        <KpiCard label="Overdue" value={data.overdue_total} type="currency" />
        <KpiCard label="Overdue %" value={data.overdue_pct} type="percent" />
        <KpiCard label="Open Accounts" value={data.open_count} type="number" />
      </div>

      {/* Donut chart */}
      {data.status_breakdown.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium" style={{ fontFamily: "var(--font-heading)" }}>Status Breakdown</h3>
          <p className="mb-3 text-xs text-muted-foreground">Outstanding balances by account status</p>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.status_breakdown}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                cornerRadius={4}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                {...animationProps}
              >
                {data.status_breakdown.map((_, i) => (
                  <Cell
                    key={i}
                    fill={PIE_COLORS[i % PIE_COLORS.length]}
                    strokeWidth={0}
                  />
                ))}
              </Pie>
              <Tooltip
                content={
                  <ChartTooltip valueFormatter={(v) => formatCurrency(v)} />
                }
              />
              <Legend
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                formatter={(value) => <span className="text-muted-foreground">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <AccountsTable accounts={data.accounts} formatCurrency={formatCurrency} />
    </div>
  );
}

const AccountsTable = memo(function AccountsTable({ accounts, formatCurrency }: { accounts: ReceivablesReport["accounts"]; formatCurrency: (v: number) => string }) {
  const { page, setPage, pageSize, total, paginatedItems } = useClientPagination(accounts);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Balance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Days Overdue</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{formatProductSummary(a.product_summary)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.balance_remaining)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={accountStatusVariant[a.status] ?? "outline"}
                    >
                      {a.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {a.days_overdue !== null ? a.days_overdue : "—"}
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