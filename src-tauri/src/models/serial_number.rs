use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SerialNumber {
    pub id: i64,
    pub variant_id: i64,
    pub serial_no: String,
    pub status: String, // "in_stock" | "sold"
    pub sale_item_id: Option<i64>,
    pub added_at: String,
    pub sold_at: Option<String>,
    pub notes: Option<String>,
}
