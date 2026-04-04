use serde::{Deserialize, Serialize};

// ── Category ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Category {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

// ── Product ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Product {
    pub id: i64,
    pub category_id: i64,
    pub name: String,
    pub description: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
    pub category_name: Option<String>,
    #[serde(default)]
    pub variants: Vec<ProductVariant>,
}

// ── Product Variant ──

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProductVariant {
    pub id: i64,
    pub product_id: i64,
    pub sku: Option<String>,
    pub attributes: Option<serde_json::Value>,
    pub cost_price: f64,
    pub selling_price: f64,
    pub stock_qty: i64,
    pub low_stock_threshold: i64,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

// ── Create / Update Payloads ──

#[derive(Debug, Deserialize)]
pub struct CreateProductPayload {
    pub category_id: i64,
    pub name: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProductPayload {
    pub id: i64,
    pub category_id: Option<i64>,
    pub name: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateVariantPayload {
    pub product_id: i64,
    pub sku: Option<String>,
    pub attributes: Option<serde_json::Value>,
    pub cost_price: f64,
    pub selling_price: f64,
    pub stock_qty: i64,
    pub low_stock_threshold: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVariantPayload {
    pub id: i64,
    pub sku: Option<String>,
    pub attributes: Option<serde_json::Value>,
    pub cost_price: Option<f64>,
    pub selling_price: Option<f64>,
    pub stock_qty: Option<i64>,
    pub low_stock_threshold: Option<i64>,
}
