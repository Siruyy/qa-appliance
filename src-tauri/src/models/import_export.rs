use serde::Serialize;
use std::collections::HashMap;

// ── Import types ───────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ImportValidRow {
    pub row_number: usize,
    pub data: HashMap<String, String>,
}

#[derive(Debug, Serialize)]
pub struct ImportErrorRow {
    pub row_number: usize,
    pub data: HashMap<String, String>,
    pub errors: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ImportSkipRow {
    pub row_number: usize,
    pub data: HashMap<String, String>,
    pub reason: String,
}

#[derive(Debug, Serialize)]
pub struct ImportPreview {
    pub valid_rows: Vec<ImportValidRow>,
    pub error_rows: Vec<ImportErrorRow>,
    pub skip_rows: Vec<ImportSkipRow>,
}

#[derive(Debug, Serialize)]
pub struct ImportResult {
    pub rows_added: i64,
    pub rows_skipped: i64,
    pub rows_errored: i64,
}

#[derive(Debug, Serialize)]
pub struct ImportLog {
    pub id: i64,
    pub import_type: String,
    pub filename: String,
    pub rows_added: i64,
    pub rows_skipped: i64,
    pub rows_errored: i64,
    pub error_details: Option<String>,
    pub imported_at: String,
    pub imported_ids: Option<String>,
}

// ── Export types ───────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ExportProduct {
    pub category: String,
    pub product_name: String,
    pub variant_color: Option<String>,
    pub variant_size: Option<String>,
    pub sku: String,
    pub cost_price: f64,
    pub selling_price: f64,
    pub installment_price: Option<f64>,
    pub stock_quantity: i64,
    pub low_stock_threshold: i64,
    pub is_active: bool,
}

#[derive(Debug, Serialize)]
pub struct ExportCategory {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExportCustomer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct ExportSale {
    pub id: i64,
    pub sale_date: String,
    pub customer_name: String,
    pub items_summary: String,
    pub total_amount: f64,
    pub discount_type: String,
    pub discount_value: f64,
    pub discount: f64,
    pub payment_type: String,
    pub down_payment: Option<f64>,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct ExportAccount {
    pub id: i64,
    pub customer_name: String,
    pub product_summary: String,
    pub principal: f64,
    pub balance_remaining: f64,
    pub interest_rate: f64,
    pub penalty_rate: f64,
    pub rebate_amount: f64,
    pub term_months: Option<i64>,
    pub has_schedule: bool,
    pub status: String,
    pub created_at: String,
}

/// Payment record for export. `payment_type` is one of: "payment", "down_payment", "penalty".
#[derive(Debug, Serialize)]
pub struct ExportPayment {
    pub id: i64,
    pub payment_date: String,
    pub customer_name: String,
    pub product_summary: String,
    pub amount: f64,
    pub payment_type: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExportAllData {
    pub products: Vec<ExportProduct>,
    pub categories: Vec<ExportCategory>,
    pub customers: Vec<ExportCustomer>,
    pub sales: Vec<ExportSale>,
    pub accounts: Vec<ExportAccount>,
    pub payments: Vec<ExportPayment>,
}
