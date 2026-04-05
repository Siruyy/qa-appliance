use serde::Serialize;

// Report 1: Sales Summary
#[derive(Debug, Serialize)]
pub struct SalesSummaryRow {
    pub id: i64,
    pub sale_date: String,
    pub customer_name: String,
    pub items_summary: String,
    pub total: f64,
    pub payment_type: String,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct DailyTotal {
    pub date: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct SalesSummaryReport {
    pub total_sales: f64,
    pub transaction_count: i64,
    pub cash_total: f64,
    pub installment_total: f64,
    pub daily_totals: Vec<DailyTotal>,
    pub sales: Vec<SalesSummaryRow>,
}

// Report 2: Receivables
#[derive(Debug, Serialize)]
pub struct ReceivablesRow {
    pub id: i64,
    pub customer_name: String,
    pub product_summary: String,
    pub balance_remaining: f64,
    pub has_schedule: bool,
    pub status: String,
    pub days_overdue: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct StatusBreakdown {
    pub label: String,
    pub value: f64,
}

#[derive(Debug, Serialize)]
pub struct ReceivablesReport {
    pub total_outstanding: f64,
    pub overdue_total: f64,
    pub overdue_pct: f64,
    pub open_count: i64,
    pub status_breakdown: Vec<StatusBreakdown>,
    pub accounts: Vec<ReceivablesRow>,
}

// Report 3: Inventory Valuation
#[derive(Debug, Serialize)]
pub struct InventoryRow {
    pub product_name: String,
    pub variant_name: String,
    pub sku: String,
    pub stock_quantity: i64,
    pub cost_price: f64,
    pub selling_price: f64,
    pub cost_value: f64,
    pub retail_value: f64,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct CategoryStock {
    pub category: String,
    pub total_stock: i64,
    pub total_cost_value: f64,
}

#[derive(Debug, Serialize)]
pub struct InventoryReport {
    pub total_retail_value: f64,
    pub total_cost_value: f64,
    pub gross_margin_pct: f64,
    pub items_in_stock: i64,
    pub low_stock_count: i64,
    pub out_of_stock_count: i64,
    pub by_category: Vec<CategoryStock>,
    pub items: Vec<InventoryRow>,
}

// Report 4: Collections
#[derive(Debug, Serialize)]
pub struct CollectionsRow {
    pub id: i64,
    pub payment_date: String,
    pub customer_name: String,
    pub product_summary: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub payment_type: String,
}

#[derive(Debug, Serialize)]
pub struct CollectionsReport {
    pub total_collected: f64,
    pub transaction_count: i64,
    pub cash_payments: f64,
    pub penalty_total: f64,
    pub daily_totals: Vec<DailyTotal>,
    pub payments: Vec<CollectionsRow>,
}

// Report 5: Customer History
#[derive(Debug, Serialize)]
pub struct CustomerSaleRow {
    pub id: i64,
    pub sale_date: String,
    pub items_summary: String,
    pub total: f64,
    pub payment_type: String,
}

#[derive(Debug, Serialize)]
pub struct CustomerPaymentRow {
    pub id: i64,
    pub payment_date: String,
    pub amount: f64,
    #[serde(rename = "type")]
    pub payment_type: String,
    pub product_summary: String,
}

#[derive(Debug, Serialize)]
pub struct CustomerHistoryReport {
    pub customer_name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub total_purchased: f64,
    pub total_paid: f64,
    pub total_balance: f64,
    pub sales: Vec<CustomerSaleRow>,
    pub payments: Vec<CustomerPaymentRow>,
}

// Report 6: Profit & Loss
#[derive(Debug, Serialize)]
pub struct CategoryRevenue {
    pub category: String,
    pub revenue: f64,
    pub cogs: f64,
    pub pct: f64,
}

#[derive(Debug, Serialize)]
pub struct ProfitLossReport {
    pub revenue: f64,
    pub cogs: f64,
    pub gross_profit: f64,
    pub gross_margin_pct: f64,
    pub by_category: Vec<CategoryRevenue>,
}

// ── Dashboard (Phase 7) ──────────────────────────────

#[derive(Debug, Serialize)]
pub struct DailySales {
    pub date: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct DailyCollection {
    pub date: String,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct RecentSale {
    pub id: i64,
    pub sale_date: String,
    pub customer_name: String,
    pub total: f64,
    pub payment_type: String,
}

#[derive(Debug, Serialize)]
pub struct UpcomingDue {
    pub account_id: i64,
    pub customer_name: String,
    pub due_date: String,
    pub amount_due: f64,
    pub product_summary: String,
}

#[derive(Debug, Serialize)]
pub struct DashboardData {
    pub today_sales_total: f64,
    pub today_sales_count: i64,
    pub month_sales_total: f64,
    pub month_sales_count: i64,
    pub last_month_sales_total: f64,
    pub total_receivables: f64,
    pub open_accounts_count: i64,
    pub overdue_accounts_count: i64,
    pub overdue_total: f64,
    pub low_stock_count: i64,
    pub sales_last_30_days: Vec<DailySales>,
    pub collections_last_30_days: Vec<DailyCollection>,
    pub recent_sales: Vec<RecentSale>,
    pub upcoming_due: Vec<UpcomingDue>,
}

// Report 7: Customer Aging
#[derive(Debug, Serialize)]
pub struct AgingBucket {
    pub customer_id: i64,
    pub customer_name: String,
    pub current: f64,
    pub days_1_30: f64,
    pub days_31_60: f64,
    pub days_61_90: f64,
    pub days_over_90: f64,
    pub total: f64,
}

#[derive(Debug, Serialize)]
pub struct AgingReport {
    pub buckets: Vec<AgingBucket>,
    pub total_current: f64,
    pub total_1_30: f64,
    pub total_31_60: f64,
    pub total_61_90: f64,
    pub total_over_90: f64,
    pub grand_total: f64,
}
