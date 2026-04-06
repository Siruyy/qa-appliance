import type { PaymentType, SaleStatus } from "./sale";
import type { AccountStatus } from "./account";

// ── Import Preview & Result ──────────────────────────────

export interface ImportErrorRow {
  row_number: number;
  data: Record<string, string>;
  errors: string[];
}

export interface ImportSkipRow {
  row_number: number;
  data: Record<string, string>;
  reason: string;
}

export interface ImportValidRow {
  row_number: number;
  data: Record<string, string>;
}

export interface ImportPreview {
  valid_rows: ImportValidRow[];
  error_rows: ImportErrorRow[];
  skip_rows: ImportSkipRow[];
}

export interface ImportResult {
  rows_added: number;
  rows_skipped: number;
  rows_errored: number;
}

export interface ImportLog {
  id: number;
  import_type: string;
  filename: string;
  rows_added: number;
  rows_skipped: number;
  rows_errored: number;
  error_details: string | null;
  imported_at: string;
}

// ── Export Data Shapes ──────────────────────────────────

export interface ExportProduct {
  category: string;
  product_name: string;
  variant_color: string | null;
  variant_size: string | null;
  sku: string;
  cost_price: number;
  selling_price: number;
  stock_quantity: number;
  low_stock_threshold: number;
  is_active: boolean;
}

export interface ExportCategory {
  id: number;
  name: string;
  description: string | null;
}

export interface ExportCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

export interface ExportSale {
  id: number;
  sale_date: string;
  customer_name: string;
  items_summary: string;
  total_amount: number;
  discount_type: string;
  discount_value: number;
  discount: number;
  payment_type: PaymentType;
  down_payment: number | null;
  status: SaleStatus;
}

export interface ExportAccount {
  id: number;
  customer_name: string;
  product_summary: string;
  principal: number;
  balance_remaining: number;
  interest_rate: number;
  penalty_rate: number;
  rebate_rate: number;
  term_months: number | null;
  has_schedule: boolean;
  status: AccountStatus;
  created_at: string;
}

export interface ExportPayment {
  id: number;
  payment_date: string;
  customer_name: string;
  product_summary: string;
  amount: number;
  payment_type: PaymentType;
  notes: string | null;
}

export interface ExportAllData {
  products: ExportProduct[];
  categories: ExportCategory[];
  customers: ExportCustomer[];
  sales: ExportSale[];
  accounts: ExportAccount[];
  payments: ExportPayment[];
}
