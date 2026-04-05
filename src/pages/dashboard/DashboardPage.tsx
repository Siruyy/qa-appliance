import { extractErrorMessage } from "@/lib/error";
import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useDashboard } from "@/hooks/useDashboard";
import { formatDate } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { paymentTypeVariant } from "@/lib/badgeVariants";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { DashboardData } from "@/types/report";
import { KpiCard } from "@/components/KpiCard";
import { ChartTooltip, gridStyle, axisTickStyle, barRadius, animationProps } from "@/components/charts";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart, TrendingUp, Wallet, AlertTriangle, BarChart3, Banknote, Receipt, CalendarClock } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";

export function DashboardPage() {
  const { fetchDashboard } = useDashboard();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartDays, setChartDays] = useState(30);
  const { format: formatCurrency } = useCurrency();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await fetchDashboard(chartDays);
      setData(d);
    } catch (err) {
      toast.error("Failed to load dashboard: " + extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, chartDays]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => (<Skeleton key={i} className="h-24 rounded-lg" />))}</div>
      </div>
    );
  }

  const monthChange =
    data.last_month_sales_total > 0
      ? (
          ((data.month_sales_total - data.last_month_sales_total) /
            data.last_month_sales_total) *
          100
        ).toFixed(1)
      : null;

  return (
    <div className="space-y-6">
      {/* Alerts */}
      {(data.overdue_accounts_count > 0 || data.low_stock_count > 0) && (
        <div className="flex flex-wrap gap-2">
          {data.overdue_accounts_count > 0 && (
            <Badge
              variant="destructive"
              className="cursor-pointer"
              onClick={() => navigate("/accounts")}
            >
              <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1" />
              {data.overdue_accounts_count} overdue account
              {data.overdue_accounts_count > 1 ? "s" : ""} (
              {formatCurrency(data.overdue_total)})
            </Badge>
          )}
          {data.low_stock_count > 0 && (
            <Badge
              variant="outline"
              className="border-amber-500 text-amber-700 dark:text-amber-400 cursor-pointer"
              onClick={() => navigate("/inventory")}
            >
              <AlertTriangle className="h-3.5 w-3.5 inline-block mr-1" />
              {data.low_stock_count} low stock item
              {data.low_stock_count > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          title="Today's Sales"
          value={formatCurrency(data.today_sales_total)}
          sub={`${data.today_sales_count} transaction${data.today_sales_count !== 1 ? "s" : ""}`}
          icon={ShoppingCart}
          color="success"
        />
        <KpiCard
          title="This Month"
          value={formatCurrency(data.month_sales_total)}
          sub={
            monthChange !== null
              ? `${Number(monthChange) >= 0 ? "+" : ""}${monthChange}% vs last month`
              : `${data.month_sales_count} transactions`
          }
          icon={TrendingUp}
          color="default"
        />
        <KpiCard
          title="Total Receivables"
          value={formatCurrency(data.total_receivables)}
          sub={`${data.open_accounts_count} open account${data.open_accounts_count !== 1 ? "s" : ""}`}
          icon={Wallet}
          color="warning"
        />
        <KpiCard
          title="Overdue"
          value={formatCurrency(data.overdue_total)}
          sub={`${data.overdue_accounts_count} account${data.overdue_accounts_count !== 1 ? "s" : ""}`}
          alert={data.overdue_accounts_count > 0}
          icon={AlertTriangle}
          color={data.overdue_accounts_count > 0 ? "danger" : "default"}
        />
      </div>

      {/* Charts */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Charts</h2>
        <div className="flex gap-1">
          {[7, 30, 60, 90].map((d) => (
            <Button
              key={d}
              variant={chartDays === d ? "default" : "outline"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setChartDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm" style={{ fontFamily: "var(--font-heading)" }}>Sales (Last {chartDays} Days)</CardTitle>
            <p className="text-xs text-muted-foreground">Daily revenue trend</p>
          </CardHeader>
          <CardContent>
            {data.sales_last_30_days.length === 0 ? (
              <EmptyState icon={BarChart3} title="No sales data yet" description="Sales data will appear here once transactions are recorded." />
            ) : (
              <div role="img" aria-label={`Sales trend chart for the last ${chartDays} days`}>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.sales_last_30_days} {...animationProps}>
                  <defs>
                    <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridStyle} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
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
                    fill="url(#salesGradient)"
                    dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, fill: "var(--background)" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm" style={{ fontFamily: "var(--font-heading)" }}>
              Collections (Last {chartDays} Days)
            </CardTitle>
            <p className="text-xs text-muted-foreground">Daily payment collections</p>
          </CardHeader>
          <CardContent>
            {data.collections_last_30_days.length === 0 ? (
              <EmptyState icon={Banknote} title="No collection data yet" description="Payment collections will appear here once recorded." />
            ) : (
                            <div role="img" aria-label={`Collections chart for the last ${chartDays} days`}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data.collections_last_30_days} {...animationProps}>
                  <defs>
                    <linearGradient id="collectionsGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.9} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.5} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid {...gridStyle} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    tick={axisTickStyle}
                    axisLine={false}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    content={
                      <ChartTooltip
                        labelFormatter={(l) => formatDate(String(l))}
                        valueFormatter={(v) => formatCurrency(v)}
                      />
                    }
                  />
                  <Bar
                    dataKey="total"
                    name="Collections"
                    fill="url(#collectionsGradient)"
                    radius={barRadius}
                  />
                </BarChart>
              </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tables */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Recent Sales */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Recent Sales</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/sales")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {data.recent_sales.length === 0 ? (
              <EmptyState icon={Receipt} title="No sales recorded yet" description="Recent sales will show up here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recent_sales.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="text-xs">
                        {formatDate(s.sale_date)}
                      </TableCell>
                      <TableCell className="truncate max-w-[120px]">
                        {s.customer_name}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(s.total)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={paymentTypeVariant[s.payment_type] ?? "outline"}
                        >
                          {s.payment_type}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Due */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm">Upcoming Payments Due</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/accounts")}
            >
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {data.upcoming_due.length === 0 ? (
              <EmptyState icon={CalendarClock} title="No upcoming payments" description="Upcoming payment due dates will appear here." />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.upcoming_due.map((u, i) => {
                    const isOverdue =
                      new Date(u.due_date) < new Date(new Date().toISOString().slice(0, 10));
                    return (
                      <TableRow
                        key={`${u.account_id}-${i}`}
                        className={isOverdue ? "text-destructive" : ""}
                      >
                        <TableCell className="text-xs">
                          {formatDate(u.due_date)}
                          {isOverdue && (
                            <span className="ml-1 text-[10px]">OVERDUE</span>
                          )}
                        </TableCell>
                        <TableCell className="truncate max-w-[120px]">
                          {u.customer_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(u.amount_due)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
