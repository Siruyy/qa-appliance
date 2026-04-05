import { extractErrorMessage } from "@/lib/error";
import { memo, useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { KpiCard } from "@/components/KpiCard";
import { invoke } from "@/lib/invoke";
import { useCurrency } from "@/hooks/useCurrency";
import { TableSkeleton } from "@/components/TableSkeleton";
import { toast } from "sonner";

interface AgingBucket {
  customer_id: number;
  customer_name: string;
  current: number;
  days_1_30: number;
  days_31_60: number;
  days_61_90: number;
  days_over_90: number;
  total: number;
}

interface AgingReport {
  buckets: AgingBucket[];
  total_current: number;
  total_1_30: number;
  total_31_60: number;
  total_61_90: number;
  total_over_90: number;
  grand_total: number;
}

export const AgingTab = memo(function AgingTab() {
  const [report, setReport] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    invoke<AgingReport>("get_aging_report")
      .then(setReport)
      .catch((e) => toast.error(`Failed to load aging report: ${extractErrorMessage(e)}`))
      .finally(() => setLoading(false));
  }, []);

  if (loading || !report) {
    return <TableSkeleton rows={8} cols={7} />;
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <KpiCard label="Current" value={formatCurrency(report.total_current)} />
        <KpiCard label="1–30 Days" value={formatCurrency(report.total_1_30)} />
        <KpiCard label="31–60 Days" value={formatCurrency(report.total_31_60)} />
        <KpiCard label="61–90 Days" value={formatCurrency(report.total_61_90)} />
        <KpiCard label="90+ Days" value={formatCurrency(report.total_over_90)} />
        <KpiCard label="Grand Total" value={formatCurrency(report.grand_total)} />
      </div>

      {report.buckets.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          No open accounts with balances.
        </p>
      ) : (
        <div className="rounded-md border overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Current</TableHead>
                <TableHead className="text-right">1–30 Days</TableHead>
                <TableHead className="text-right">31–60 Days</TableHead>
                <TableHead className="text-right">61–90 Days</TableHead>
                <TableHead className="text-right">90+ Days</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.buckets.map((b) => (
                <TableRow key={b.customer_id}>
                  <TableCell className="font-medium">{b.customer_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.current > 0 ? formatCurrency(b.current) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.days_1_30 > 0 ? formatCurrency(b.days_1_30) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.days_31_60 > 0 ? formatCurrency(b.days_31_60) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {b.days_61_90 > 0 ? formatCurrency(b.days_61_90) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-[var(--danger)]">
                    {b.days_over_90 > 0 ? formatCurrency(b.days_over_90) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(b.total)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="font-bold">
                <TableCell>Totals</TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(report.total_current)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(report.total_1_30)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(report.total_31_60)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(report.total_61_90)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-[var(--danger)]">
                  {formatCurrency(report.total_over_90)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatCurrency(report.grand_total)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      )}
    </div>
  );
});
