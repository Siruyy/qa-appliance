import { useEffect, useState } from "react";
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
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useCurrency } from "@/hooks/useCurrency";
import type { ReceivablesReport } from "@/types/report";
import { toast } from "sonner";

const PIE_COLORS = ["#2563eb", "#f59e0b", "#ef4444", "#10b981", "#6366f1"];

export function ReceivablesTab() {
  const { statusFilter } = useReportStore();
  const { getReceivablesReport } = useReports();
  const [data, setData] = useState<ReceivablesReport | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    getReceivablesReport(statusFilter === "all" ? undefined : statusFilter)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [statusFilter]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  const { format: formatCurrency } = useCurrency();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Outstanding" value={data.total_outstanding} type="currency" />
        <KpiCard label="Overdue" value={data.overdue_total} type="currency" />
        <KpiCard label="Overdue %" value={data.overdue_pct} type="percent" />
        <KpiCard label="Open Accounts" value={data.open_count} type="number" />
      </div>

      {/* Pie chart */}
      {data.status_breakdown.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium">Status Breakdown</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.status_breakdown}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
              >
                {data.status_breakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
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
            {data.accounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No accounts found
                </TableCell>
              </TableRow>
            ) : (
              data.accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.customer_name}</TableCell>
                  <TableCell className="max-w-[200px] truncate">{a.product_summary}</TableCell>
                  <TableCell className="text-right">{formatCurrency(a.balance_remaining)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        a.status === "open" ? "default" : a.status === "closed" ? "secondary" : "destructive"
                      }
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
    </div>
  );
}
