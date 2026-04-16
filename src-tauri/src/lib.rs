mod commands;
mod db;
mod models;
mod services;
mod utils;

use db::connection::{self, DbState};
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let conn = connection::init();

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(DbState(Mutex::new(conn)))
        .invoke_handler(tauri::generate_handler![
            commands::db::ping,
            commands::db::backup_database,
            commands::db::restore_database,
            commands::db::get_database_path,
            commands::db::reset_database,
            commands::db::seed_demo_data,
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
            commands::accounts::get_accounts,
            commands::accounts::get_account_by_id,
            commands::accounts::get_overdue_accounts,
            commands::accounts::mark_account_paid,
            commands::accounts::mark_account_defaulted,
            commands::accounts::update_account_notes,
            commands::accounts::run_penalty_check,
            commands::accounts::recalculate_balance,
            commands::payments::get_payments,
            commands::payments::get_payments_for_account,
            commands::payments::record_payment,
            commands::reports::get_sales_summary,
            commands::reports::get_receivables_report,
            commands::reports::get_inventory_valuation_report,
            commands::reports::get_collections_report,
            commands::reports::get_customer_history_report,
            commands::reports::get_profit_loss_report,
            commands::reports::get_aging_report,
            commands::import_export::export_products_data,
            commands::import_export::export_customers_data,
            commands::import_export::export_sales_data,
            commands::import_export::export_accounts_data,
            commands::import_export::export_payments_data,
            commands::import_export::export_all_data,
            commands::import_export::preview_import,
            commands::import_export::confirm_import,
            commands::import_export::list_import_logs,
            commands::import_export::get_import_template_columns,
            commands::import_export::generate_import_template,
            commands::import_export::undo_import,
            commands::settings::get_all_settings,
            commands::settings::update_setting,
            commands::settings::update_settings_batch,
            commands::dashboard::get_dashboard_data,
            commands::audit_log::get_audit_log,
            commands::payments::void_payment,
            commands::payments::waive_penalty,
            commands::accounts::update_account_rebate_amount,
            commands::accounts::restructure_account,
            commands::stock_movements::get_stock_movements,
            commands::serial_numbers::get_serial_numbers,
            commands::serial_numbers::add_serial_numbers,
            commands::serial_numbers::delete_serial_number,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
