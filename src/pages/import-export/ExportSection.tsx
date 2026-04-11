import { useCallback, useState } from "react";
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
import { toExcel, toExcelMultiSheet, toPdf, toCsv } from "@/lib/export";
import { useCurrency } from "@/hooks/useCurrency";
import { formatProductSummary } from "@/lib/formatters";
import { Loader2 } from "lucide-react";

type ExportFormat = "excel" | "csv" | "pdf";

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
  const [format, setFormat] = useState<ExportFormat>("excel");

  const handleExport = useCallback(
    async (type: string) => {
      setExportLoading(true);
      try {
        switch (type) {
          case "products": {
            const data = await exportProducts();
            const headers = ["Category", "Product Name", "Color", "Size", "SKU", "Cost Price", "Selling Price", "Stock", "Low Stock Threshold", "Active"];
            const rows = data.map((p) => [
              p.category, p.product_name, p.variant_color ?? "", p.variant_size ?? "",
              p.sku, formatCurrency(p.cost_price), formatCurrency(p.selling_price),
              String(p.stock_quantity), String(p.low_stock_threshold), p.is_active ? "Yes" : "No",
            ]);
            if (format === "excel") await toExcel({ filename: "products_export", sheetName: "Products", headers, rows });
            else if (format === "csv") await toCsv({ filename: "products_export", headers, rows });
            else await toPdf({ filename: "products_export", title: "Products & Inventory", headers, rows });
            toast.success(`Exported ${data.length} products`);
            break;
          }
          case "customers": {
            const data = await exportCustomers();
            const headers = ["ID", "Name", "Phone", "Address", "Notes", "Active", "Created"];
            const rows = data.map((c) => [String(c.id), c.name, c.phone ?? "", c.address ?? "", c.notes ?? "", c.is_active ? "Yes" : "No", c.created_at]);
            if (format === "excel") await toExcel({ filename: "customers_export", sheetName: "Customers", headers, rows });
            else if (format === "csv") await toCsv({ filename: "customers_export", headers, rows });
            else await toPdf({ filename: "customers_export", title: "Customers", headers, rows });
            toast.success(`Exported ${data.length} customers`);
            break;
          }
          case "sales": {
            const data = await exportSales();
            const headers = ["ID", "Date", "Customer", "Items", "Total", "Discount Type", "Discount Value", "Discount (₱)", "Payment Type", "Down Payment", "Status"];
            const rows = data.map((s) => [
              String(s.id), s.sale_date, s.customer_name, s.items_summary,
              formatCurrency(s.total_amount), s.discount_type,
              s.discount_type === "percent" ? `${s.discount_value}%` : formatCurrency(s.discount_value),
              formatCurrency(s.discount), s.payment_type,
              s.down_payment != null ? formatCurrency(s.down_payment) : "", s.status,
            ]);
            if (format === "excel") await toExcel({ filename: "sales_export", sheetName: "Sales", headers, rows });
            else if (format === "csv") await toCsv({ filename: "sales_export", headers, rows });
            else await toPdf({ filename: "sales_export", title: "Sales History", headers, rows, orientation: "landscape" });
            toast.success(`Exported ${data.length} sales`);
            break;
          }
          case "accounts": {
            const data = await exportAccounts();
            const headers = ["ID", "Customer", "Product", "Principal", "Balance", "Interest %", "Penalty %", "Rebate ₱", "Term", "Status", "Created"];
            const rows = data.map((a) => [
              String(a.id), a.customer_name, formatProductSummary(a.product_summary),
              formatCurrency(a.principal), formatCurrency(a.balance_remaining),
              `${a.interest_rate}%`, `${a.penalty_rate}%`,
              a.rebate_amount > 0 ? `₱${a.rebate_amount.toFixed(2)}` : "—",
              a.term_months ? `${a.term_months} mo` : "N/A", a.status, a.created_at,
            ]);
            if (format === "excel") await toExcel({ filename: "accounts_export", sheetName: "Accounts", headers, rows });
            else if (format === "csv") await toCsv({ filename: "accounts_export", headers, rows });
            else await toPdf({ filename: "accounts_export", title: "Installment Accounts", headers, rows, orientation: "landscape" });
            toast.success(`Exported ${data.length} accounts`);
            break;
          }
          case "payments": {
            const data = await exportPayments();
            const headers = ["ID", "Date", "Customer", "Product", "Amount", "Type", "Notes"];
            const rows = data.map((p) => [
              String(p.id), p.payment_date, p.customer_name,
              formatProductSummary(p.product_summary), formatCurrency(p.amount),
              p.payment_type, p.notes ?? "",
            ]);
            if (format === "excel") await toExcel({ filename: "payments_export", sheetName: "Payments", headers, rows });
            else if (format === "csv") await toCsv({ filename: "payments_export", headers, rows });
            else await toPdf({ filename: "payments_export", title: "Payment Records", headers, rows });
            toast.success(`Exported ${data.length} payments`);
            break;
          }
          case "all": {
            // All Data always uses Excel multi-sheet (single-file multi-entity)
            const data = await exportAllData();
            const total = data.products.length + data.customers.length + data.sales.length + data.accounts.length + data.payments.length;
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
                  rows: data.categories.map((c) => [String(c.id), c.name, c.description ?? ""]),
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
                  headers: ["ID", "Date", "Customer", "Items", "Total", "Discount Type", "Discount (₱)", "Payment Type", "Down Payment", "Status"],
                  rows: data.sales.map((s) => [
                    String(s.id), s.sale_date, s.customer_name, s.items_summary,
                    formatCurrency(s.total_amount), s.discount_type, formatCurrency(s.discount),
                    s.payment_type, s.down_payment != null ? formatCurrency(s.down_payment) : "", s.status,
                  ]),
                },
                {
                  sheetName: "Accounts",
                  headers: ["ID", "Customer", "Product", "Principal", "Balance", "Interest %", "Penalty %", "Rebate ₱", "Term", "Status", "Created"],
                  rows: data.accounts.map((a) => [
                    String(a.id), a.customer_name, formatProductSummary(a.product_summary),
                    formatCurrency(a.principal), formatCurrency(a.balance_remaining),
                    `${a.interest_rate}%`, `${a.penalty_rate}%`,
                    a.rebate_amount > 0 ? `₱${a.rebate_amount.toFixed(2)}` : "—",
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
    [format, setExportLoading, formatCurrency]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Export Data</h3>
        <p className="text-sm text-muted-foreground">
          Download your data for backup or analysis.
        </p>
      </div>

      {/* Format selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Format:</span>
        <div className="inline-flex rounded-md border overflow-hidden text-sm">
          {(["excel", "csv", "pdf"] as ExportFormat[]).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              className={`px-3 py-1.5 transition-colors ${
                format === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-background hover:bg-muted text-foreground"
              }`}
            >
              {f === "excel" ? "📊 Excel" : f === "csv" ? "📄 CSV" : "🖨 PDF"}
            </button>
          ))}
        </div>
        {format !== "excel" && (
          <span className="text-xs text-muted-foreground">
            "Export All Data" always uses Excel (multi-sheet)
          </span>
        )}
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
                {exportLoading ? (
                  <><Loader2 className="mr-1 h-4 w-4 animate-spin" /> Exporting…</>
                ) : btn.type === "all" ? (
                  "Export (Excel)"
                ) : (
                  `Export ${format === "excel" ? "Excel" : format.toUpperCase()}`
                )}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

