import { useState, useCallback } from "react";
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
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { extractErrorMessage } from "@/lib/error";
import { useImportExportStore } from "@/stores/importExportStore";
import { previewImport, confirmImport } from "@/lib/importExport";
import { ImportPreviewDialog } from "./ImportPreviewDialog";

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

export function ImportSection() {
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
      toast.error(`Preview failed: ${extractErrorMessage(err)}`);
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
      toast.error(`Import failed: ${extractErrorMessage(err)}`);
    } finally {
      setImporting(false);
    }
  }, [importType, selectedFile, setImporting, resetImport]);

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
