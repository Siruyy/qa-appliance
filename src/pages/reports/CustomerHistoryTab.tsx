import { useEffect, useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { KpiCard } from "./KpiCard";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { CustomerHistoryReport } from "@/types/report";
import { toast } from "sonner";
import { invoke } from "@tauri-apps/api/core";

interface CustomerOption {
  id: number;
  name: string;
}

export function CustomerHistoryTab() {
  const { selectedCustomerId, setSelectedCustomerId, dateFrom, dateTo } = useReportStore();
  const { getCustomerHistoryReport } = useReports();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [data, setData] = useState<CustomerHistoryReport | null>(null);
  const [loading, setLoading] = useState(false);

  // Load customer list for selector
  useEffect(() => {
    invoke<{ id: number; first_name: string; last_name: string }[]>("list_customers", {
      searchQuery: null,
      isActive: true,
    })
      .then((list) =>
        setCustomers(list.map((c) => ({ id: c.id, name: `${c.first_name} ${c.last_name}` })))
      )
      .catch(() => {});
  }, []);

  // Load report when customer selected
  useEffect(() => {
    if (!selectedCustomerId) {
      setData(null);
      return;
    }
    setLoading(true);
    getCustomerHistoryReport(selectedCustomerId, dateFrom, dateTo)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [selectedCustomerId, dateFrom, dateTo]);

  return (
    <div className="space-y-6">
      {/* Customer selector */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Customer</label>
        <Select
          value={selectedCustomerId?.toString() ?? ""}
          onValueChange={(val) => setSelectedCustomerId(val ? Number(val) : null)}
        >
          <SelectTrigger className="w-[260px]">
            <SelectValue placeholder="Select a customer…" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id.toString()}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedCustomerId && (
        <p className="py-8 text-center text-muted-foreground">Select a customer to view history</p>
      )}

      {loading && <p className="py-8 text-center text-muted-foreground">Loading…</p>}

      {data && !loading && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard label="Total Purchased" value={data.total_purchased} type="currency" />
            <KpiCard label="Total Paid" value={data.total_paid} type="currency" />
            <KpiCard label="Balance" value={data.total_balance} type="currency" />
            <KpiCard
              label="Contact"
              value={data.phone ?? "—"}
            />
          </div>

          {/* Sales */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Sales</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.sales.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No sales
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.sales.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{formatDate(s.sale_date)}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{s.items_summary}</TableCell>
                        <TableCell className="text-right">{formatCurrency(s.total)}</TableCell>
                        <TableCell>
                          <Badge variant={s.payment_type === "cash" ? "default" : "secondary"}>
                            {s.payment_type}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Payments */}
          <div>
            <h3 className="mb-2 text-sm font-medium">Payments</h3>
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No payments
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.payments.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{formatDate(p.payment_date)}</TableCell>
                        <TableCell className="max-w-[250px] truncate">{p.product_summary}</TableCell>
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
          </div>
        </>
      )}
    </div>
  );
}
