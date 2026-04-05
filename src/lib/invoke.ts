import { invoke as tauriInvoke } from "@tauri-apps/api/core";

/** Known Tauri command names — keeps invoke calls type-safe at runtime */
const ALLOWED_COMMANDS = new Set([
  // Products & Inventory
  "get_products", "get_product_by_id", "create_product", "update_product",
  "delete_product", "create_variant", "update_variant", "delete_variant",
  "get_categories", "create_category", "update_category", "delete_category",
  // Sales
  "get_sales", "get_sale_by_id", "create_sale", "void_sale",
  // Accounts
  "get_accounts", "get_account_by_id", "record_payment", "update_account_notes",
  "recalculate_balance", "apply_penalties",
  // Customers
  "get_customers", "get_customer_by_id", "create_customer", "update_customer", "delete_customer",
  // Settings & Dashboard
  "get_settings", "update_settings", "get_dashboard_data",
  // Reports
  "get_sales_report", "get_inventory_report", "get_receivables_report",
  // Audit
  "get_audit_logs",
  // Import/Export
  "export_all_data", "import_all_data",
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
