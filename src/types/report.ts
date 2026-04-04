export interface DashboardStats {
  total_products: number;
  low_stock_count: number;
  total_sales_today: number;
  revenue_today: number;
  open_accounts: number;
  overdue_accounts: number;
  total_receivables: number;
  collections_this_month: number;
}

export interface SalesReportRow {
  date: string;
  cash_sales: number;
  installment_sales: number;
  total: number;
}

export interface CollectionsReportRow {
  date: string;
  payments: number;
  penalties: number;
  total: number;
}
