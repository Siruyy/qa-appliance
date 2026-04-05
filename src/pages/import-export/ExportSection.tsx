import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import { useImportExportStore } from "@/stores/importExportStore";
import {
  exportProducts,
  exportCustomers,
  exportSales,
  exportAccounts,
  exportPayments,
  exportAllData,
} from "@/lib/importExport";
import { toExcel, toExcelMultiSheet } from "@/lib/export";
import { useCurrency } from "@/hooks/useCurrency";
import { formatProductSummary } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

const exportButtons = [
  { type: "products", label: "Products & Inventory", icon: "📦" },
  { type: "customers", label: "Customers", icon: "👥" },
  { type: "sales", label: "Sales History", icon: "🧾" },
  { type: "accounts", label: "Installment Accounts", icon: "📋" },
  { type: "payments", label: "Payment Records", icon: "💰" },
  { type: "all", label: "Export All Data", icon: "📊" },
];

export function ExportSection() {
  const { exportLoading, setExportLoading } = useImportExportStore();
  const { format: formatCurrency } = useCurrency();

  const handleExport = useCallback(
    async (type: string) => {
      setExportLoading(true);
      try {
        switch (type) {
          case "products": {
            const data = await exportProducts();
            await toExcel({
              filename: "products_export",
              sheetName: "Products",
              headers: [
                "Category",
                "Product Name",
                "Color",
                "Size",
                "SKU",
                "Cost Price",
                "Selling Price",
                "Stock",
                "Low Stock Threshold",
                "Active",
              ],
              rows: data.map((p) => [
                p.category,
                p.product_name,
                p.variant_color ?? "",
                p.variant_size ?? "",
                p.sku,
                formatCurrency(p.cost_price),
                formatCurrency(p.selling_price),
                String(p.stock_quantity),
                String(p.low_stock_threshold),
                p.is_active ? "Yes" : "No",
              ]),
            });
            toast.success(`Exported ${data.length} products`);
            break;
          }
          case "customers": {
            const data = await exportCustomers();
            await toExcel({
              filename: "customers_export",
              sheetName: "Customers",
              headers: ["ID", "Name", "Phone", "Address", "Notes", "Active", "Created"],
              rows: data.map((c) => [
                String(c.id),
                c.name,
                c.phone ?? "",
                c.address ?? "",
                c.notes ?? "",
                c.is_active ? "Yes" : "No",
                c.created_at,
              ]),
            });
            toast.success(`Exported ${data.length} customers`);
            break;
          }
          case "sales": {
            const data = await exportSales();
            await toExcel({
              filename: "sales_export",
              sheetName: "Sales",
              headers: [
                "ID",
                "Date",
                "Customer",
                "Items",
                "Total",
                "Payment Type",
                "Down Payment",
                "Status",
              ],
              rows: data.map((s) => [
                String(s.id),
                s.sale_date,
                s.customer_name,
                s.items_summary,
                formatCurrency(s.total_amount),
                s.payment_type,
                s.down_payment != null ? formatCurrency(s.down_payment) : "",
                s.status,
              ]),
            });
            toast.success(`Exported ${data.length} sales`);
            break;
          }
          case "accounts": {
            const data = await exportAccounts();
            await toExcel({
              filename: "accounts_export",
              sheetName: "Accounts",
              headers: [
                "ID",
                "Customer",
                "Product",
                "Principal",
                "Balance",
                "Interest %",
                "Penalty %",
                "Term",
                "Status",
                "Created",
              ],
              rows: data.map((a) => [
                String(a.id),
                a.customer_name,
                formatProductSummary(a.product_summary),
                formatCurrency(a.principal),
                formatCurrency(a.balance_remaining),
                `${a.interest_rate}%`,
                `${a.penalty_rate}%`,
                a.term_months ? `${a.term_months} mo` : "N/A",
                a.status,
                a.created_at,
              ]),
            });
            toast.success(`Exported ${data.length} accounts`);
            break;
          }
          case "payments": {
            const data = await exportPayments();
            await toExcel({
              filename: "payments_export",
              sheetName: "Payments",
              headers: ["ID", "Date", "Customer", "Product", "Amount", "Type", "Notes"],
              rows: data.map((p) => [
                String(p.id),
                p.payment_date,
                p.customer_name,
                formatProductSummary(p.product_summary),
                formatCurrency(p.amount),
                p.payment_type,
                p.notes ?? "",
              ]),
            });
            toast.success(`Exported ${data.length} payments`);
            break;
          }
          case "all": {
            const data = await exportAllData();
            const total =
              data.products.length +
              data.customers.length +
              data.sales.length +
              data.accounts.length +
              data.payments.length;
            await toExcelMultiSheet({
              filename: "all_data_export",
              sheets: [
                {
                  sheetName: "Products",
                  headers: ["Category", "Product Name", "Color", "Size", "SKU", "Cost", "Price", "Stock", "Active"],
                  rows: data.products.map((p) => [
                    p.category, p.product_name, p.variant_color ?? "", p.variant_size ?? "",
                    p.sku, formatCurrency(p.cost_price), formatCurrency(p.selling_price),
                    String(p.stock_quantity), p.is_active ? "Yes" : "No",
                  ]),
                },
                {
                  sheetName: "Categories",
                  headers: ["ID", "Name", "Description"],
                  rows: data.categories.map((c) => [
                    String(c.id), c.name, c.description ?? "",
                  ]),
                },
                {
                  sheetName: "Customers",
                  headers: ["ID", "Name", "Phone", "Address", "Notes", "Active", "Created"],
                  rows: data.customers.map((c) => [
                    String(c.id), c.name, c.phone ?? "", c.address ?? "",
                    c.notes ?? "", c.is_active ? "Yes" : "No", c.created_at,
                  ]),
                },
                {
                  sheetName: "Sales",
                  headers: ["ID", "Date", "Customer", "Items", "Total", "Payment Type", "Down Payment", "Status"],
                  rows: data.sales.map((s) => [
                    String(s.id), s.sale_date, s.customer_name, s.items_summary,
                    formatCurrency(s.total_amount), s.payment_type,
                    s.down_payment != null ? formatCurrency(s.down_payment) : "", s.status,
                  ]),
                },
                {
                  sheetName: "Accounts",
                  headers: ["ID", "Customer", "Product", "Principal", "Balance", "Interest %", "Penalty %", "Term", "Status", "Created"],
                  rows: data.accounts.map((a) => [
                    String(a.id), a.customer_name, formatProductSummary(a.product_summary),
                    formatCurrency(a.principal), formatCurrency(a.balance_remaining),
                    `${a.interest_rate}%`, `${a.penalty_rate}%`,
                    a.term_months ? `${a.term_months} mo` : "N/A", a.status, a.created_at,
                  ]),
                },
                {
                  sheetName: "Payments",
                  headers: ["ID", "Date", "Customer", "Product", "Amount", "Type", "Notes"],
                  rows: data.payments.map((p) => [
                    String(p.id), p.payment_date, p.customer_name,
                    formatProductSummary(p.product_summary), formatCurrency(p.amount),
                    p.payment_type, p.notes ?? "",
                  ]),
                },
              ],
            });
            toast.success(`Exported ${total} records across all data`);
            break;
          }
        }
      } catch (err) {
        toast.error(`Export failed: ${extractErrorMessage(err)}`);
      } finally {
        setExportLoading(false);
      }
    },
    [setExportLoading]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Export Data</h3>
        <p className="text-sm text-muted-foreground">
          Download your data as Excel spreadsheets for backup or analysis.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {exportButtons.map((btn) => (
          <Card key={btn.type} className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{btn.icon}</span>
                <span className="font-medium text-sm">{btn.label}</span>
              </div>
              <Button
                size="sm"
                variant={btn.type === "all" ? "default" : "outline"}
                disabled={exportLoading}
                onClick={() => handleExport(btn.type)}
              >
                {exportLoading ? <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Exporting…</> : "Export"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
