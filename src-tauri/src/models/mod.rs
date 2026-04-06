pub mod account;
pub mod customer;
pub mod import_export;
pub mod payment;
pub mod report;
pub mod sale;
pub mod product;
pub mod stock_movement;

#[derive(Debug, serde::Serialize)]
pub struct PaginatedResult<T: serde::Serialize> {
    pub items: Vec<T>,
    pub total: u64,
}
