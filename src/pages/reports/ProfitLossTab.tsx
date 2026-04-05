import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { KpiCard } from "@/components/KpiCard";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useCurrency } from "@/hooks/useCurrency";
import type { ProfitLossReport } from "@/types/report";
import { toast } from "sonner";

export function ProfitLossTab() {
  const { dateFrom, dateTo } = useReportStore();
  const { getProfitLossReport } = useReports();
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    getProfitLossReport(dateFrom, dateTo)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [dateFrom, dateTo]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <KpiCard label="Revenue" value={data.revenue} type="currency" />
        <KpiCard label="COGS" value={data.cogs} type="currency" />
        <KpiCard label="Gross Profit" value={data.gross_profit} type="currency" />
        <KpiCard label="Gross Margin" value={data.gross_margin_pct} type="percent" />
      </div>

      {/* Grouped bar chart by category */}
      {data.by_category.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium">Revenue vs COGS by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.by_category}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Legend />
              <Bar dataKey="revenue" fill="var(--chart-1)" name="Revenue" />
              <Bar dataKey="cogs" fill="var(--chart-3)" name="COGS" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">COGS</TableHead>
              <TableHead className="text-right">Profit</TableHead>
              <TableHead className="text-right">Margin %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.by_category.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No data for this period
                </TableCell>
              </TableRow>
            ) : (
              <>
                {data.by_category.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell>{c.category}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.revenue)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.cogs)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.revenue - c.cogs)}</TableCell>
                    <TableCell className="text-right">{c.pct.toFixed(1)}%</TableCell>
                  </TableRow>
                ))}
                {/* Totals row */}
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.cogs)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(data.gross_profit)}</TableCell>
                  <TableCell className="text-right">{data.gross_margin_pct.toFixed(1)}%</TableCell>
                </TableRow>
              </>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
