use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct StockMovement {
    pub id: i64,
    pub variant_id: i64,
    pub product_name: String,
    pub variant_label: Option<String>,
    pub delta: i64,
    pub reason: String,
    pub reference_type: Option<String>,
    pub reference_id: Option<i64>,
    pub notes: Option<String>,
    pub created_at: String,
}
