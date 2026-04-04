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
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useDashboard } from "@/hooks/useDashboard";
import { useSettingsStore } from "@/stores/settingsStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import type { DashboardData } from "@/types/report";

function KpiCard({
  title,
  value,
  sub,
  alert,
}: {
  title: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-destructive" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardPage() {
  const { fetchDashboard } = useDashboard();
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await loadSettings();
      const d = await fetchDashboard();
      setData(d);
    } catch (err) {
      toast.error("Failed to load dashboard: " + String(err));
    } finally {
      setLoading(false);
    }
  }, [fetchDashboard, loadSettings]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading dashboard…</p>
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
              ⚠ {data.overdue_accounts_count} overdue account
              {data.overdue_accounts_count > 1 ? "s" : ""} (
              {formatCurrency(data.overdue_total)})
            </Badge>
          )}
          {data.low_stock_count > 0 && (
            <Badge
              variant="outline"
              className="border-yellow-500 text-yellow-700 cursor-pointer"
              onClick={() => navigate("/inventory")}
            >
              ⚠ {data.low_stock_count} low stock item
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
        />
        <KpiCard
          title="This Month"
          value={formatCurrency(data.month_sales_total)}
          sub={
            monthChange !== null
              ? `${Number(monthChange) >= 0 ? "+" : ""}${monthChange}% vs last month`
              : `${data.month_sales_count} transactions`
          }
        />
        <KpiCard
          title="Total Receivables"
          value={formatCurrency(data.total_receivables)}
          sub={`${data.open_accounts_count} open account${data.open_accounts_count !== 1 ? "s" : ""}`}
        />
        <KpiCard
          title="Overdue"
          value={formatCurrency(data.overdue_total)}
          sub={`${data.overdue_accounts_count} account${data.overdue_accounts_count !== 1 ? "s" : ""}`}
          alert={data.overdue_accounts_count > 0}
        />
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Sales (Last 30 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.sales_last_30_days.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No sales data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.sales_last_30_days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    labelFormatter={(l) => formatDate(String(l))}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">
              Collections (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.collections_last_30_days.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">
                No collection data yet
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.collections_last_30_days}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(d) => d.slice(5)}
                    fontSize={11}
                  />
                  <YAxis
                    tickFormatter={(v) => `₱${(v / 1000).toFixed(0)}k`}
                    fontSize={11}
                  />
                  <Tooltip
                    formatter={(v) => formatCurrency(Number(v))}
                    labelFormatter={(l) => formatDate(String(l))}
                  />
                  <Bar dataKey="total" fill="#10B981" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              <p className="text-muted-foreground text-sm text-center py-4">
                No sales recorded yet
              </p>
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
                          variant={
                            s.payment_type === "cash" ? "secondary" : "outline"
                          }
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
              <p className="text-muted-foreground text-sm text-center py-4">
                No upcoming payments
              </p>
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
