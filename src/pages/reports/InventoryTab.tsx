import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
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
import { KpiCard } from "@/components/KpiCard";
import { Pagination } from "@/components/Pagination";
import { useReports } from "@/hooks/useReports";
import { useReportStore } from "@/stores/reportStore";
import { useClientPagination } from "@/hooks/useClientPagination";
import { useCurrency } from "@/hooks/useCurrency";
import type { InventoryReport } from "@/types/report";
import { toast } from "sonner";

export function InventoryTab() {
  const { categoryId } = useReportStore();
  const { getInventoryValuationReport } = useReports();
  const [data, setData] = useState<InventoryReport | null>(null);
  const [loading, setLoading] = useState(false);
  const { format: formatCurrency } = useCurrency();

  useEffect(() => {
    setLoading(true);
    getInventoryValuationReport(categoryId ?? undefined)
      .then(setData)
      .catch((e) => toast.error(String(e)))
      .finally(() => setLoading(false));
  }, [categoryId]);

  if (loading) return <p className="py-8 text-center text-muted-foreground">Loading…</p>;
  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Retail Value" value={data.total_retail_value} type="currency" />
        <KpiCard label="Cost Value" value={data.total_cost_value} type="currency" />
        <KpiCard label="Gross Margin" value={data.gross_margin_pct} type="percent" />
        <KpiCard label="In Stock" value={data.items_in_stock} type="number" />
        <KpiCard label="Low Stock" value={data.low_stock_count} type="number" />
        <KpiCard label="Out of Stock" value={data.out_of_stock_count} type="number" />
      </div>

      {/* Bar chart by category */}
      {data.by_category.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-4 text-sm font-medium">Stock by Category</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_category}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="category" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(Number(v))} />
              <Bar dataKey="total_cost_value" fill="#2563eb" name="Cost Value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <ItemsTable items={data.items} formatCurrency={formatCurrency} />
    </div>
  );
}

function ItemsTable({ items, formatCurrency }: { items: InventoryReport["items"]; formatCurrency: (v: number) => string }) {
  const { page, setPage, pageSize, total, paginatedItems } = useClientPagination(items);

  return (
    <>
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead className="text-right">Cost</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Cost Value</TableHead>
              <TableHead className="text-right">Retail Value</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No inventory items found
                </TableCell>
              </TableRow>
            ) : (
              paginatedItems.map((item, i) => (
                <TableRow key={i}>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>{item.variant_name}</TableCell>
                  <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                  <TableCell className="text-right">{item.stock_quantity}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.selling_price)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.cost_value)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.retail_value)}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.status === "in_stock" ? "default" : item.status === "low_stock" ? "secondary" : "destructive"
                      }
                    >
                      {item.status.replace("_", " ")}
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
}
