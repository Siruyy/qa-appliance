import { useState, useEffect, useCallback } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useImportExportStore } from "@/stores/importExportStore";
import { PageHeader } from "@/components/PageHeader";
import {
  exportProducts,
  exportCustomers,
  exportSales,
  exportAccounts,
  exportPayments,
  exportAllData,
  previewImport,
  confirmImport,
  fetchImportLogs,
} from "@/hooks/useImportExport";
import { toExcel } from "@/lib/export";
import { useCurrency } from "@/hooks/useCurrency";
import type { ImportPreview } from "@/types/import-export";

// ── Export Section ───────────────────────────────────

function ExportSection() {
  const { exportLoading, setExportLoading } = useImportExportStore();

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
                a.product_summary,
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
                p.product_summary,
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
            // Export each category as a separate sheet
            await toExcel({
              filename: "all_data_export",
              sheetName: "Products",
              headers: [
                "Category",
                "Product Name",
                "Color",
                "Size",
                "SKU",
                "Cost",
                "Price",
                "Stock",
                "Active",
              ],
              rows: data.products.map((p) => [
                p.category,
                p.product_name,
                p.variant_color ?? "",
                p.variant_size ?? "",
                p.sku,
                formatCurrency(p.cost_price),
                formatCurrency(p.selling_price),
                String(p.stock_quantity),
                p.is_active ? "Yes" : "No",
              ]),
            });
            toast.success(`Exported ${total} records across all data`);
            break;
          }
        }
      } catch (err) {
        toast.error(`Export failed: ${err}`);
      } finally {
        setExportLoading(false);
      }
    },
    [setExportLoading]
  );

  const exportButtons = [
    { type: "products", label: "Products & Inventory", icon: "📦" },
    { type: "customers", label: "Customers", icon: "👥" },
    { type: "sales", label: "Sales History", icon: "🧾" },
    { type: "accounts", label: "Installment Accounts", icon: "📋" },
    { type: "payments", label: "Payment Records", icon: "💰" },
    { type: "all", label: "Export All Data", icon: "📊" },
  ];

  const { format: formatCurrency } = useCurrency();
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
                {exportLoading ? "Exporting…" : "Export"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── Import Section ───────────────────────────────────

function ImportSection() {
  const {
    importType,
    setImportType,
    selectedFile,
    setSelectedFile,
    preview,
    setPreview,
    importing,
    setImporting,
    resetImport,
  } = useImportExportStore();

  const [previewOpen, setPreviewOpen] = useState(false);

  const handleSelectFile = useCallback(async () => {
    const filePath = await open({
      multiple: false,
      filters: [{ name: "Excel Files", extensions: ["xlsx", "xls"] }],
    });
    if (filePath) {
      setSelectedFile(filePath as string);
      setPreview(null);
    }
  }, [setSelectedFile, setPreview]);

  const handlePreview = useCallback(async () => {
    if (!selectedFile) return;
    try {
      const result = await previewImport(importType, selectedFile);
      setPreview(result);
      setPreviewOpen(true);
    } catch (err) {
      toast.error(`Preview failed: ${err}`);
    }
  }, [importType, selectedFile, setPreview]);

  const handleConfirm = useCallback(async () => {
    if (!selectedFile) return;
    setImporting(true);
    try {
      const result = await confirmImport(importType, selectedFile);
      toast.success(
        `Import complete: ${result.rows_added} added, ${result.rows_skipped} skipped, ${result.rows_errored} errors`
      );
      setPreviewOpen(false);
      resetImport();
    } catch (err) {
      toast.error(`Import failed: ${err}`);
    } finally {
      setImporting(false);
    }
  }, [importType, selectedFile, setImporting, resetImport]);

  const templateHelp: Record<string, string[]> = {
    products: [
      "category",
      "product_name",
      "variant_color",
      "variant_size",
      "sku",
      "cost_price",
      "selling_price",
      "stock_qty",
      "low_stock_threshold",
    ],
    customers: ["name", "phone", "address", "notes"],
    balances: [
      "customer_name",
      "customer_phone",
      "product_description",
      "original_amount",
      "balance_remaining",
      "interest_rate",
      "penalty_rate",
      "has_schedule",
      "term_months",
      "monthly_amount",
      "start_date",
      "notes",
    ],
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Import Data</h3>
        <p className="text-sm text-muted-foreground">
          Import data from Excel files. Preview before confirming.
        </p>
      </div>

      <Card className="p-4 space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Import Type</label>
            <Select
              value={importType}
              onValueChange={(v) => {
                if (v) {
                  setImportType(v as "products" | "customers" | "balances");
                  resetImport();
                }
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="products">Products</SelectItem>
                <SelectItem value="customers">Customers</SelectItem>
                <SelectItem value="balances">Outstanding Balances</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" onClick={handleSelectFile}>
            {selectedFile ? "Change File" : "Select File"}
          </Button>

          {selectedFile && (
            <Button onClick={handlePreview}>
              Preview Import
            </Button>
          )}
        </div>

        {selectedFile && (
          <div className="text-sm text-muted-foreground">
            Selected: <span className="font-mono">{selectedFile.split("/").pop()}</span>
          </div>
        )}

        <Separator />

        <div>
          <p className="text-sm font-medium mb-2">
            Required columns for "{importType}" import:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {templateHelp[importType]?.map((col) => (
              <Badge key={col} variant="secondary" className="font-mono text-xs">
                {col}
              </Badge>
            ))}
          </div>
        </div>
      </Card>

      {/* Preview Modal */}
      <ImportPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        preview={preview}
        onConfirm={handleConfirm}
        importing={importing}
        importType={importType}
      />
    </div>
  );
}

// ── Import Preview Dialog ────────────────────────────

function ImportPreviewDialog({
  open,
  onOpenChange,
  preview,
  onConfirm,
  importing,
  importType,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  preview: ImportPreview | null;
  onConfirm: () => void;
  importing: boolean;
  importType: string;
}) {
  if (!preview) return null;

  const totalRows =
    preview.valid_rows.length + preview.error_rows.length + preview.skip_rows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Import Preview — {importType}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 mb-4">
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{preview.valid_rows.length}</div>
            <div className="text-xs text-muted-foreground">Valid</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-red-600">{preview.error_rows.length}</div>
            <div className="text-xs text-muted-foreground">Errors</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold text-yellow-600">{preview.skip_rows.length}</div>
            <div className="text-xs text-muted-foreground">Skipped</div>
          </Card>
          <Card className="flex-1 p-3 text-center">
            <div className="text-2xl font-bold">{totalRows}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </Card>
        </div>

        <Tabs defaultValue="valid" className="flex-1">
          <TabsList className="w-full">
            <TabsTrigger value="valid" className="flex-1">
              Valid ({preview.valid_rows.length})
            </TabsTrigger>
            <TabsTrigger value="errors" className="flex-1">
              Errors ({preview.error_rows.length})
            </TabsTrigger>
            <TabsTrigger value="skipped" className="flex-1">
              Skipped ({preview.skip_rows.length})
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="h-[300px] mt-2">
            <TabsContent value="valid">
              {preview.valid_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No valid rows.</p>
              ) : (
                <PreviewTable
                  rows={preview.valid_rows.slice(0, 50).map((r) => ({
                    row: r.row_number,
                    data: r.data,
                  }))}
                />
              )}
            </TabsContent>

            <TabsContent value="errors">
              {preview.error_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No errors.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Errors</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.error_rows.slice(0, 50).map((r) => (
                      <TableRow key={r.row_number}>
                        <TableCell>{r.row_number}</TableCell>
                        <TableCell>
                          {r.errors.map((e, i) => (
                            <Badge key={i} variant="destructive" className="mr-1 mb-1 text-xs">
                              {e}
                            </Badge>
                          ))}
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {Object.values(r.data).filter(Boolean).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>

            <TabsContent value="skipped">
              {preview.skip_rows.length === 0 ? (
                <p className="text-sm text-muted-foreground p-4">No skipped rows.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Row</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Data</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.skip_rows.slice(0, 50).map((r) => (
                      <TableRow key={r.row_number}>
                        <TableCell>{r.row_number}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.reason}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs font-mono max-w-[200px] truncate">
                          {Object.values(r.data).filter(Boolean).join(", ")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={importing || preview.valid_rows.length === 0}
          >
            {importing
              ? "Importing…"
              : `Import ${preview.valid_rows.length} row${preview.valid_rows.length !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Generic preview table for valid rows ─────────────

function PreviewTable({
  rows,
}: {
  rows: { row: number; data: Record<string, string> }[];
}) {
  if (rows.length === 0) return null;
  const columns = Object.keys(rows[0].data);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-16">Row</TableHead>
          {columns.map((col) => (
            <TableHead key={col} className="text-xs">
              {col}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.row}>
            <TableCell>{r.row}</TableCell>
            {columns.map((col) => (
              <TableCell key={col} className="text-xs max-w-[150px] truncate">
                {r.data[col] ?? ""}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// ── Import History ───────────────────────────────────

function ImportHistory() {
  const { logs, setLogs } = useImportExportStore();

  useEffect(() => {
    fetchImportLogs(20).then(setLogs).catch(() => {});
  }, [setLogs]);

  if (logs.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Import History</h3>
        <p className="text-sm text-muted-foreground">No imports yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Import History</h3>
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>File</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="text-right">Skipped</TableHead>
              <TableHead className="text-right">Errors</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {logs.map((log) => (
              <TableRow key={log.id}>
                <TableCell className="text-sm">{log.imported_at}</TableCell>
                <TableCell>
                  <Badge variant="outline">{log.import_type}</Badge>
                </TableCell>
                <TableCell className="text-sm font-mono max-w-[200px] truncate">
                  {log.filename}
                </TableCell>
                <TableCell className="text-right text-green-600 font-medium">
                  {log.rows_added}
                </TableCell>
                <TableCell className="text-right text-yellow-600">
                  {log.rows_skipped}
                </TableCell>
                <TableCell className="text-right text-red-600">
                  {log.rows_errored}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────

export function ImportExportPage() {
  return (
    <div className="space-y-8 p-1">
      <PageHeader
        title="Import / Export"
        description="Bulk data import and export tools for backup and data migration."
      />

      <ExportSection />
      <Separator />
      <ImportSection />
      <Separator />
      <ImportHistory />
    </div>
  );
}
