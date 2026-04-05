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
import { ChartTooltip, gridStyle, axisTickStyle, barRadius, animationProps } from "@/components/charts";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useCurrency } from "@/hooks/useCurrency";
import type { ProfitLossReport } from "@/types/report";
import { TableSkeleton } from "@/components/TableSkeleton";
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
  }, [dateFrom, dateTo, getProfitLossReport]);

  if (loading) return <Table><TableSkeleton cols={4} /></Table>;
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
          <h3 className="mb-4 text-sm font-medium" style={{ fontFamily: "var(--font-heading)" }}>Revenue vs COGS by Category</h3>
          <p className="mb-3 text-xs text-muted-foreground">Gross margin breakdown by product category</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.by_category} {...animationProps} barGap={2}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.55} />
                </linearGradient>
                <linearGradient id="cogsGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-3)" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="var(--chart-3)" stopOpacity={0.55} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridStyle} vertical={false} />
              <XAxis dataKey="category" tick={axisTickStyle} axisLine={false} tickLine={false} />
              <YAxis tick={axisTickStyle} tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`} axisLine={false} tickLine={false} width={48} />
              <Tooltip
                content={
                  <ChartTooltip valueFormatter={(v) => formatCurrency(v)} />
                }
              />
              <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
              <Bar dataKey="revenue" fill="url(#revenueGradient)" name="Revenue" radius={barRadius} />
              <Bar dataKey="cogs" fill="url(#cogsGradient)" name="COGS" radius={barRadius} />
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
