use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct InstallmentAccount {
    pub id: i64,
    pub sale_id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub product_summary: String,
    pub principal: f64,
    pub down_payment: f64,
    pub interest_rate: f64,
    pub penalty_rate: f64,
    pub balance_remaining: f64,
    pub has_schedule: bool,
    pub term_months: Option<i64>,
    pub monthly_amount: Option<f64>,
    pub start_date: Option<String>,
    pub status: String,
    pub last_penalty_date: Option<String>,
    pub next_due_date: Option<String>,
    pub is_overdue: bool,
    pub rebate_amount: f64,
    pub interest_type: String,
    pub rebate_credited: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct AccountDetail {
    pub id: i64,
    pub sale_id: i64,
    pub customer_id: i64,
    pub customer_name: String,
    pub product_summary: String,
    pub principal: f64,
    pub down_payment: f64,
    pub interest_rate: f64,
    pub penalty_rate: f64,
    pub balance_remaining: f64,
    pub has_schedule: bool,
    pub term_months: Option<i64>,
    pub monthly_amount: Option<f64>,
    pub start_date: Option<String>,
    pub status: String,
    pub last_penalty_date: Option<String>,
    pub next_due_date: Option<String>,
    pub is_overdue: bool,
    pub rebate_amount: f64,
    pub interest_type: String,
    pub rebate_credited: f64,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub schedule: Vec<PaymentScheduleEntry>,
    pub payments: Vec<AccountPayment>,
}

#[derive(Debug, Serialize)]
pub struct PaymentScheduleEntry {
    pub id: i64,
    pub account_id: i64,
    pub due_date: String,
    pub amount_due: f64,
    pub amount_paid: f64,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct AccountPayment {
    pub id: i64,
    pub amount: f64,
    pub payment_date: String,
    #[serde(rename = "type")]
    pub payment_type: String,
    pub notes: Option<String>,
    pub is_reversed: bool,
    pub reversed_at: Option<String>,
    pub reversed_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PenaltyApplied {
    pub account_id: i64,
    pub customer_name: String,
    pub product_summary: String,
    pub penalty_amount: f64,
}
