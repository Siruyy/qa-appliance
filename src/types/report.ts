import type { PaymentType, SaleStatus } from "./sale";
import type { AccountStatus } from "./account";
import type { PaymentRecordType } from "./payment";

export type StockStatus = "In Stock" | "Low Stock" | "Out of Stock";

// Shared
export interface ReportKPI {
  label: string;
  value: string | number;
  type: "currency" | "number" | "percent";
}

// Dashboard full data (Phase 7)
export interface DailySales {
  date: string;
  total: number;
}

export interface DailyCollection {
  date: string;
  total: number;
}

export interface RecentSale {
  id: number;
  sale_date: string;
  customer_name: string;
  total: number;
  payment_type: PaymentType;
}

export interface UpcomingDue {
  account_id: number;
  customer_name: string;
  due_date: string;
  amount_due: number;
  product_summary: string;
}

export interface DashboardData {
  today_sales_total: number;
  today_sales_count: number;
  month_sales_total: number;
  month_sales_count: number;
  last_month_sales_total: number;
  total_receivables: number;
  open_accounts_count: number;
  overdue_accounts_count: number;
  overdue_total: number;
  low_stock_count: number;
  sales_last_30_days: DailySales[];
  collections_last_30_days: DailyCollection[];
  recent_sales: RecentSale[];
  upcoming_due: UpcomingDue[];
}

// Report 1: Sales Summary
export interface SalesSummaryRow {
  id: number;
  sale_date: string;
  customer_name: string;
  items_summary: string;
  total: number;
  payment_type: PaymentType;
  status: SaleStatus;
}

export interface DailyTotal {
  date: string;
  total: number;
}

export interface SalesSummaryReport {
  total_sales: number;
  transaction_count: number;
  cash_total: number;
  installment_total: number;
  voided_count: number;
  voided_total: number;
  discount_total: number;
  daily_totals: DailyTotal[];
  sales: SalesSummaryRow[];
}

// Report 2: Receivables
export interface ReceivablesRow {
  id: number;
  customer_name: string;
  product_summary: string;
  balance_remaining: number;
  has_schedule: boolean;
  status: AccountStatus;
  days_overdue: number | null;
}

export interface StatusBreakdown {
  label: string;
  value: number;
}

export interface ReceivablesReport {
  total_outstanding: number;
  overdue_total: number;
  overdue_pct: number;
  open_count: number;
  status_breakdown: StatusBreakdown[];
  accounts: ReceivablesRow[];
}

// Report 3: Inventory Valuation
export interface InventoryRow {
  product_name: string;
  variant_name: string;
  sku: string;
  stock_quantity: number;
  cost_price: number;
  selling_price: number;
  cost_value: number;
  retail_value: number;
  status: StockStatus;
}

export interface CategoryStock {
  category: string;
  total_stock: number;
  total_cost_value: number;
}

export interface InventoryReport {
  total_retail_value: number;
  total_cost_value: number;
  gross_margin_pct: number;
  items_in_stock: number;
  low_stock_count: number;
  out_of_stock_count: number;
  by_category: CategoryStock[];
  items: InventoryRow[];
}

// Report 4: Collections
export interface CollectionsRow {
  id: number;
  payment_date: string;
  customer_name: string;
  product_summary: string;
  amount: number;
  type: PaymentRecordType;
}

export interface CollectionsReport {
  total_collected: number;
  transaction_count: number;
  cash_payments: number;
  penalty_total: number;
  rebate_total: number;
  daily_totals: DailyTotal[];
  payments: CollectionsRow[];
}

// Report 5: Customer History
export interface CustomerSaleRow {
  id: number;
  sale_date: string;
  items_summary: string;
  total: number;
  payment_type: PaymentType;
}

export interface CustomerPaymentRow {
  id: number;
  payment_date: string;
  amount: number;
  type: PaymentRecordType;
  product_summary: string;
}

export interface CustomerHistoryReport {
  customer_name: string;
  phone: string | null;
  address: string | null;
  total_purchased: number;
  total_paid: number;
  total_balance: number;
  sales: CustomerSaleRow[];
  payments: CustomerPaymentRow[];
}

// Report 6: Profit & Loss
export interface CategoryRevenue {
  category: string;
  revenue: number;
  cogs: number;
  pct: number;
}

export interface ProfitLossReport {
  revenue: number;
  cogs: number;
  gross_profit: number;
  gross_margin_pct: number;
  by_category: CategoryRevenue[];
}
