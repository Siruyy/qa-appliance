mod commands;
mod db;

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
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
