use tauri::State;
use crate::db::connection::DbState;

/// Simple ping command to verify the Rust backend and database are alive.
#[tauri::command]
pub fn ping(db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let version: String = conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!("pong — SQLite {}", version))
}
