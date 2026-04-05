import { useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useReportStore, type ReportTab } from "@/stores/reportStore";
import { useReports } from "@/hooks/useReports";
import { toExcel, toPdf, toCsv } from "@/lib/export";
import { formatProductSummary } from "@/lib/formatters";
import { useCurrency } from "@/hooks/useCurrency";
import { toast } from "sonner";

import { SalesSummaryTab } from "./SalesSummaryTab";
import { ReceivablesTab } from "./ReceivablesTab";
import { InventoryTab } from "./InventoryTab";
import { CollectionsTab } from "./CollectionsTab";
import { CustomerHistoryTab } from "./CustomerHistoryTab";
import { ProfitLossTab } from "./ProfitLossTab";
import { AgingTab } from "./AgingTab";
import { PageHeader } from "@/components/PageHeader";
import { DatePicker } from "@/components/DatePicker";

const TAB_CONFIG: { value: ReportTab; label: string }[] = [
  { value: "sales", label: "Sales Summary" },
  { value: "receivables", label: "Receivables" },
  { value: "inventory", label: "Inventory" },
  { value: "collections", label: "Collections" },
  { value: "customer-history", label: "Customer History" },
  { value: "profit-loss", label: "Profit & Loss" },
  { value: "aging", label: "Aging" },
];

// Tabs that use date range filter
const DATE_TABS: ReportTab[] = ["sales", "collections", "customer-history", "profit-loss"];

export function ReportsPage() {
  const {
    activeTab,
    setActiveTab,
    dateFrom,
    dateTo,
    setDateFrom,
    setDateTo,
    statusFilter,
    setStatusFilter,
    selectedCustomerId,
  } = useReportStore();

  const {
    getSalesSummary,
    getReceivablesReport,
    getInventoryValuationReport,
    getCollectionsReport,
    getCustomerHistoryReport,
    getProfitLossReport,
  } = useReports();

  const { format: formatCurrency } = useCurrency();

  const handleExport = useCallback(
    async (format: "excel" | "pdf" | "csv") => {
      try {
        const tabLabel = TAB_CONFIG.find((t) => t.value === activeTab)?.label ?? activeTab;
        const dateRange = `${dateFrom} to ${dateTo}`;

        // Fetch current report data for export
        if (activeTab === "sales") {
          const report = await getSalesSummary(dateFrom, dateTo);
          const kpis = [
            { label: "Total Sales", value: formatCurrency(report.total_sales) },
            { label: "Transactions", value: String(report.transaction_count) },
            { label: "Cash", value: formatCurrency(report.cash_total) },
            { label: "Installment", value: formatCurrency(report.installment_total) },
          ];
          const headers = ["Date", "Customer", "Items", "Total", "Payment", "Status"];
          const rows = report.sales.map((s) => [
            s.sale_date,
            s.customer_name,
            s.items_summary,
            s.total,
            s.payment_type,
            s.status,
          ]);
          doExport(format, `sales-summary`, tabLabel, dateRange, kpis, headers, rows);
        } else if (activeTab === "receivables") {
          const report = await getReceivablesReport(statusFilter === "all" ? undefined : statusFilter);
          const kpis = [
            { label: "Outstanding", value: formatCurrency(report.total_outstanding) },
            { label: "Overdue", value: formatCurrency(report.overdue_total) },
            { label: "Open", value: String(report.open_count) },
          ];
          const headers = ["Customer", "Product", "Balance", "Status", "Days Overdue"];
          const rows = report.accounts.map((a) => [
            a.customer_name,
            formatProductSummary(a.product_summary),
            a.balance_remaining,
            a.status,
            a.days_overdue,
          ]);
          doExport(format, `receivables`, tabLabel, undefined, kpis, headers, rows);
        } else if (activeTab === "inventory") {
          const report = await getInventoryValuationReport();
          const kpis = [
            { label: "Retail Value", value: formatCurrency(report.total_retail_value) },
            { label: "Cost Value", value: formatCurrency(report.total_cost_value) },
            { label: "Gross Margin", value: `${report.gross_margin_pct.toFixed(1)}%` },
          ];
          const headers = ["Product", "Variant", "SKU", "Stock", "Cost", "Price", "Cost Value", "Retail Value", "Status"];
          const rows = report.items.map((i) => [
            i.product_name,
            i.variant_name,
            i.sku,
            i.stock_quantity,
            i.cost_price,
            i.selling_price,
            i.cost_value,
            i.retail_value,
            i.status,
          ]);
          doExport(format, `inventory-valuation`, tabLabel, undefined, kpis, headers, rows);
        } else if (activeTab === "collections") {
          const report = await getCollectionsReport(dateFrom, dateTo);
          const kpis = [
            { label: "Total Collected", value: formatCurrency(report.total_collected) },
            { label: "Transactions", value: String(report.transaction_count) },
          ];
          const headers = ["Date", "Customer", "Product", "Amount", "Type"];
          const rows = report.payments.map((p) => [
            p.payment_date,
            p.customer_name,
            formatProductSummary(p.product_summary),
            p.amount,
            p.type,
          ]);
          doExport(format, `collections`, tabLabel, dateRange, kpis, headers, rows);
        } else if (activeTab === "customer-history" && selectedCustomerId) {
          const report = await getCustomerHistoryReport(selectedCustomerId, dateFrom, dateTo);
          const kpis = [
            { label: "Purchased", value: formatCurrency(report.total_purchased) },
            { label: "Paid", value: formatCurrency(report.total_paid) },
            { label: "Balance", value: formatCurrency(report.total_balance) },
          ];
          const headers = ["Date", "Items/Product", "Amount", "Type"];
          const salesRows = report.sales.map((s) => [s.sale_date, s.items_summary, s.total, s.payment_type]);
          const paymentRows = report.payments.map((p) => [p.payment_date, formatProductSummary(p.product_summary), p.amount, p.type]);
          const rows = [...salesRows, ["---", "--- Payments ---", "---", "---"], ...paymentRows];
          doExport(format, `customer-${report.customer_name}`, tabLabel, dateRange, kpis, headers, rows);
        } else if (activeTab === "profit-loss") {
          const report = await getProfitLossReport(dateFrom, dateTo);
          const kpis = [
            { label: "Revenue", value: formatCurrency(report.revenue) },
            { label: "COGS", value: formatCurrency(report.cogs) },
            { label: "Gross Profit", value: formatCurrency(report.gross_profit) },
            { label: "Margin", value: `${report.gross_margin_pct.toFixed(1)}%` },
          ];
          const headers = ["Category", "Revenue", "COGS", "Profit", "Margin %"];
          const rows = report.by_category.map((c) => [
            c.category,
            c.revenue,
            c.cogs,
            c.revenue - c.cogs,
            `${c.pct.toFixed(1)}%`,
          ]);
          doExport(format, `profit-loss`, tabLabel, dateRange, kpis, headers, rows);
        }
        toast.success(`Exported as ${format.toUpperCase()}`);
      } catch (e) {
        toast.error(`Export failed: ${e}`);
      }
    },
    [activeTab, dateFrom, dateTo, statusFilter, selectedCustomerId]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Reports"
        description="Generate and export business reports."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => handleExport("excel")}>
              Excel
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("pdf")}>
              PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => handleExport("csv")}>
              CSV
            </Button>
          </div>
        }
      />

      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        {DATE_TABS.includes(activeTab) && (
          <>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">From</label>
              <DatePicker
                value={dateFrom}
                onChange={setDateFrom}
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground">To</label>
              <DatePicker
                value={dateTo}
                onChange={setDateTo}
              />
            </div>
          </>
        )}

        {activeTab === "receivables" && (
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="h-8 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as ReportTab)}
        className="space-y-4"
      >
        <TabsList className="flex w-full flex-wrap">
          {TAB_CONFIG.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex-1">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="sales">
          <SalesSummaryTab />
        </TabsContent>
        <TabsContent value="receivables">
          <ReceivablesTab />
        </TabsContent>
        <TabsContent value="inventory">
          <InventoryTab />
        </TabsContent>
        <TabsContent value="collections">
          <CollectionsTab />
        </TabsContent>
        <TabsContent value="customer-history">
          <CustomerHistoryTab />
        </TabsContent>
        <TabsContent value="profit-loss">
          <ProfitLossTab />
        </TabsContent>
        <TabsContent value="aging">
          <AgingTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Shared helper to dispatch export based on format
function doExport(
  format: "excel" | "pdf" | "csv",
  filename: string,
  title: string,
  dateRange: string | undefined,
  kpis: { label: string; value: string }[],
  headers: string[],
  rows: (string | number | null)[][]
) {
  if (format === "excel") {
    toExcel({ filename, sheetName: title, kpis, headers, rows });
  } else if (format === "pdf") {
    toPdf({ filename, title, dateRange, kpis, headers, rows });
  } else {
    toCsv({ filename, headers, rows });
  }
}
