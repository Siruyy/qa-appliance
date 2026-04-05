import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/** Known Tauri command names — keeps invoke calls type-safe at runtime */
const ALLOWED_COMMANDS = new Set([
  // Products & Inventory
  "get_categories", "create_category", "update_category", "delete_category",
  "create_product", "update_product", "archive_product", "restore_product",
  "create_variant", "update_variant", "archive_variant", "adjust_stock",
  // Sales
  "get_sales_summary", "get_sale_by_id", "create_sale", "void_sale",
  // Accounts
  "get_account_by_id", "get_overdue_accounts", "get_payments_for_account",
  "record_payment", "update_account_notes", "recalculate_balance",
  "run_penalty_check", "mark_account_paid", "mark_account_defaulted",
  // Customers
  "get_customer_by_id", "create_customer", "update_customer",
  "archive_customer", "restore_customer",
  // Settings & Dashboard
  "get_dashboard_data", "get_database_path",
  // Reports
  "get_receivables_report", "get_inventory_valuation_report",
  "get_collections_report", "get_customer_history_report",
  "get_profit_loss_report", "get_aging_report",
  // Import/Export & Backup
  "export_all_data", "export_products_data", "export_sales_data",
  "export_accounts_data", "export_customers_data", "export_payments_data",
  "preview_import", "confirm_import", "list_import_logs",
  "backup_database", "restore_database",
] as const);

/**
 * Typed wrapper around Tauri's invoke. All IPC calls go through here
 * for consistent error handling, allowlist validation, and type safety.
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!ALLOWED_COMMANDS.has(cmd as never)) {
    const msg = `Unknown command: ${cmd}`;
    if (import.meta.env.DEV) console.error(`[invoke] ${msg}`);
    throw new Error(msg);
  }

  try {
    return await tauriInvoke<T>(cmd, args);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error(`[invoke] ${cmd} failed:`, error);
    }
    throw typeof error === "string" ? new Error(error) : error;
  }
}
