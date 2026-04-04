mod commands;
mod db;
mod models;
mod services;

use db::connection::{self, DbState};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = connection::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            commands::db::ping,
            commands::products::get_categories,
            commands::products::create_category,
            commands::products::update_category,
            commands::products::delete_category,
            commands::products::get_products,
            commands::products::get_product_by_id,
            commands::products::create_product,
            commands::products::update_product,
            commands::products::archive_product,
            commands::products::restore_product,
            commands::products::get_variants_for_product,
            commands::products::create_variant,
            commands::products::update_variant,
            commands::products::archive_variant,
            commands::products::adjust_stock,
            commands::customers::get_customers,
            commands::customers::get_customer_by_id,
            commands::customers::create_customer,
            commands::customers::update_customer,
            commands::customers::archive_customer,
            commands::customers::restore_customer,
            commands::sales::get_sales,
            commands::sales::get_sale_by_id,
            commands::sales::create_sale,
            commands::sales::void_sale,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
