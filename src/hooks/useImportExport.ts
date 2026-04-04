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

export async function exportProducts(): Promise<ExportProduct[]> {
  return invoke<ExportProduct[]>("export_products_data");
}

export async function exportCustomers(): Promise<ExportCustomer[]> {
  return invoke<ExportCustomer[]>("export_customers_data");
}

export async function exportSales(
  startDate?: string,
  endDate?: string
): Promise<ExportSale[]> {
  return invoke<ExportSale[]>("export_sales_data", {
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });
}

export async function exportAccounts(): Promise<ExportAccount[]> {
  return invoke<ExportAccount[]>("export_accounts_data");
}

export async function exportPayments(
  startDate?: string,
  endDate?: string
): Promise<ExportPayment[]> {
  return invoke<ExportPayment[]>("export_payments_data", {
    startDate: startDate ?? null,
    endDate: endDate ?? null,
  });
}

export async function exportAllData(): Promise<ExportAllData> {
  return invoke<ExportAllData>("export_all_data");
}

// ── Import hooks ─────────────────────────────────────

export async function previewImport(
  importType: string,
  filePath: string
): Promise<ImportPreview> {
  return invoke<ImportPreview>("preview_import", { importType, filePath });
}

export async function confirmImport(
  importType: string,
  filePath: string
): Promise<ImportResult> {
  return invoke<ImportResult>("confirm_import", { importType, filePath });
}

export async function fetchImportLogs(
  limit?: number
): Promise<ImportLog[]> {
  return invoke<ImportLog[]>("list_import_logs", { limit: limit ?? null });
}
