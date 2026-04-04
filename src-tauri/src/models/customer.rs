use serde::{Deserialize, Serialize};

// ── Customer ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Customer {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub open_accounts_count: i64,
    pub total_balance: f64,
    pub created_at: String,
    pub updated_at: String,
}

/// Lighter struct when we don't need computed fields
#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerBasic {
    pub id: i64,
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

// ── Customer Detail (includes linked data) ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerDetail {
    pub customer: Customer,
    pub sales: Vec<CustomerSaleSummary>,
    pub accounts: Vec<CustomerAccountSummary>,
    pub payments: Vec<CustomerPaymentSummary>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerSaleSummary {
    pub id: i64,
    pub sale_date: String,
    pub total: f64,
    pub payment_type: String,
    pub status: String,
    pub items_summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerAccountSummary {
    pub id: i64,
    pub sale_id: i64,
    pub principal: f64,
    pub balance_remaining: f64,
    pub has_schedule: bool,
    pub term_months: Option<i64>,
    pub monthly_amount: Option<f64>,
    pub status: String,
    pub items_summary: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CustomerPaymentSummary {
    pub id: i64,
    pub account_id: i64,
    pub amount: f64,
    pub payment_date: String,
    pub r#type: String,
    pub notes: Option<String>,
}

// ── Create / Update Payloads ──

#[derive(Debug, Deserialize)]
pub struct CreateCustomerPayload {
    pub name: String,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateCustomerPayload {
    pub id: i64,
    pub name: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub notes: Option<String>,
}
