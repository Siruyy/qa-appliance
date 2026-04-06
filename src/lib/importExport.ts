import { invoke } from "@/lib/invoke";
import type {
  ImportPreview,
  ImportResult,
  ImportLog,
  ExportProduct,
  ExportCustomer,
  ExportSale,
  ExportAccount,
  ExportPayment,
  ExportAllData,
} from "@/types/import-export";

// ── Export hooks ──────────────────────────────────────

/** Export all products as a flat array. */
export async function exportProducts(): Promise<ExportProduct[]> {
  return invoke<ExportProduct[]>("export_products_data");
}

/** Export all customers as a flat array. */
export async function exportCustomers(): Promise<ExportCustomer[]> {
  return invoke<ExportCustomer[]>("export_customers_data");
}

/** Export sales within an optional date range. */
export async function exportSales(
  startDate?: string,
  endDate?: string
): Promise<ExportSale[]> {
  return invoke<ExportSale[]>("export_sales_data", {
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });
}

/** Export all installment accounts. */
export async function exportAccounts(): Promise<ExportAccount[]> {
  return invoke<ExportAccount[]>("export_accounts_data");
}

/** Export payments within an optional date range. */
export async function exportPayments(
  startDate?: string,
  endDate?: string
): Promise<ExportPayment[]> {
  return invoke<ExportPayment[]>("export_payments_data", {
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });
}

/** Export all data types bundled into a single object. */
export async function exportAllData(): Promise<ExportAllData> {
  return invoke<ExportAllData>("export_all_data");
}

// ── Import hooks ─────────────────────────────────────

/** Preview an import file before committing changes. */
export async function previewImport(
  importType: string,
  filePath: string
): Promise<ImportPreview> {
  return invoke<ImportPreview>("preview_import", { importType, filePath });
}

/** Execute a previously-previewed import. */
export async function confirmImport(
  importType: string,
  filePath: string
): Promise<ImportResult> {
  return invoke<ImportResult>("confirm_import", { importType, filePath });
}

/** Fetch recent import log entries. */
export async function fetchImportLogs(
  limit?: number
): Promise<ImportLog[]> {
  return invoke<ImportLog[]>("list_import_logs", { limit: limit ?? null });
}

/** Get template columns for an import type. */
export async function getImportTemplateColumns(
  importType: string
): Promise<string[]> {
  return invoke<string[]>("get_import_template_columns", { importType });
}

/** Generate and save a template file. */
export async function generateImportTemplate(
  importType: string,
  filePath: string
): Promise<void> {
  return invoke<void>("generate_import_template", { importType, filePath });
}

/** Undo a previous import by log ID. */
export async function undoImport(
  importLogId: number
): Promise<string> {
  return invoke<string>("undo_import", { importLogId });
}
