use tauri::State;
use crate::db::connection::{DbState, db_path};

/// Simple ping command to verify the Rust backend and database are alive.
#[tauri::command]
pub fn ping(db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let version: String = conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    Ok(format!("pong — SQLite {}", version))
}

/// Create a backup of the database to the specified path.
#[tauri::command]
pub fn backup_database(db: State<'_, DbState>, dest_path: String) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Checkpoint WAL to ensure all data is in the main file
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("WAL checkpoint failed: {}", e))?;

    let src = db_path();
    let dest = std::path::PathBuf::from(&dest_path);

    // Ensure parent directory exists
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create backup directory: {}", e))?;
    }

    std::fs::copy(&src, &dest)
        .map_err(|e| format!("Backup copy failed: {}", e))?;

    Ok(dest_path)
}

/// Restore the database from the specified backup file.
/// The app should be restarted after this operation.
#[tauri::command]
pub fn restore_database(db: State<'_, DbState>, src_path: String) -> Result<String, String> {
    let src = std::path::PathBuf::from(&src_path);
    if !src.exists() {
        return Err("Backup file does not exist".into());
    }

    // Validate the backup is a valid SQLite database
    let test_conn = rusqlite::Connection::open(&src)
        .map_err(|e| format!("Invalid database file: {}", e))?;
    let _version: String = test_conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| format!("Cannot read database: {}", e))?;
    drop(test_conn);

    let dest = db_path();

    // Close current connection by locking it
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("WAL checkpoint failed: {}", e))?;

    std::fs::copy(&src, &dest)
        .map_err(|e| format!("Restore copy failed: {}", e))?;

    Ok("Database restored. Please restart the application.".into())
}

/// Get the path to the database file (for display in Settings).
#[tauri::command]
pub fn get_database_path() -> String {
    db_path().to_string_lossy().to_string()
}
