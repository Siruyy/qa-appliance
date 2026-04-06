use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Payment {
    pub id: i64,
    pub account_id: i64,
    pub schedule_id: Option<i64>,
    pub customer_name: String,
    pub product_summary: String,
    pub amount: f64,
    pub payment_date: String,
    #[serde(rename = "type")]
    pub payment_type: String,
    pub notes: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct RecordPaymentResult {
    pub payment: Payment,
    pub rebate_credited: f64,
}

#[derive(Debug, Deserialize)]
pub struct RecordPaymentPayload {
    pub account_id: i64,
    pub schedule_id: Option<i64>,
    pub amount: f64,
    pub payment_date: String,
    pub notes: Option<String>,
}
