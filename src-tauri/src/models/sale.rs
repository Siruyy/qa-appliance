use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Sale {
    pub id: i64,
    pub customer_id: Option<i64>,
    pub sale_date: String,
    pub subtotal: f64,
    pub discount: f64,
    pub total: f64,
    pub payment_type: String,
    pub status: String,
    pub notes: Option<String>,
    pub created_at: String,
    pub customer_name: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleItem {
    pub id: i64,
    pub sale_id: i64,
    pub variant_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
    pub subtotal: f64,
    pub cost_price_snapshot: f64,
    pub created_at: String,
    pub product_name: Option<String>,
    pub variant_label: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SaleDetail {
    pub sale: Sale,
    pub items: Vec<SaleItem>,
    pub account: Option<InstallmentAccountSummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct InstallmentAccountSummary {
    pub id: i64,
    pub principal: f64,
    pub down_payment: f64,
    pub interest_rate: f64,
    pub balance_remaining: f64,
    pub term_months: Option<i64>,
    pub monthly_amount: Option<f64>,
    pub status: String,
}

// --- Payloads ---

#[derive(Debug, Deserialize)]
pub struct CreateSalePayload {
    pub customer_id: Option<i64>,
    pub payment_type: String,
    pub discount: f64,
    pub notes: Option<String>,
    pub items: Vec<CreateSaleItemPayload>,
    pub installment: Option<CreateInstallmentPayload>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSaleItemPayload {
    pub variant_id: i64,
    pub quantity: i64,
    pub unit_price: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateInstallmentPayload {
    pub down_payment: f64,
    pub interest_rate: f64,
    pub penalty_rate: f64,
    pub has_schedule: bool,
    pub term_months: Option<i64>,
    pub start_date: Option<String>,
}
