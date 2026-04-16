use tauri::State;
use crate::db::connection::{DbState, db_path};

/// Validate a file path is safe (no directory traversal, reasonable extension).
fn validate_db_path(path: &std::path::Path) -> Result<(), String> {
    let path_str = path.to_string_lossy();
    if path_str.contains("..") {
        return Err("Path traversal not allowed".into());
    }
    // Must have a .db extension
    match path.extension().and_then(|e| e.to_str()) {
        Some("db") | Some("sqlite") | Some("sqlite3") | Some("bak") => Ok(()),
        _ => Err("File must have a .db, .sqlite, .sqlite3, or .bak extension".into()),
    }
}

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
    let dest = std::path::PathBuf::from(&dest_path);
    validate_db_path(&dest)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;
    // Checkpoint WAL to ensure all data is in the main file
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("WAL checkpoint failed: {}", e))?;

    let src = db_path();

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
    validate_db_path(&src)?;

    if !src.exists() {
        return Err("Backup file does not exist".into());
    }

    // Validate the backup is a valid SQLite database with our expected schema
    let test_conn = rusqlite::Connection::open(&src)
        .map_err(|e| format!("Invalid database file: {}", e))?;
    let _version: String = test_conn
        .query_row("SELECT sqlite_version()", [], |row| row.get(0))
        .map_err(|e| format!("Cannot read database: {}", e))?;
    // Check that it contains our tables
    let table_count: i64 = test_conn
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name IN ('products', 'sales', 'customers')",
            [],
            |row| row.get(0),
        )
        .map_err(|e| format!("Cannot verify database schema: {}", e))?;
    if table_count < 3 {
        return Err("File does not appear to be a valid Quality Appliance database".into());
    }
    drop(test_conn);

    let dest = db_path();

    // Lock and checkpoint before replacing
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")
        .map_err(|e| format!("WAL checkpoint failed: {}", e))?;
    // Close the connection explicitly before replacing file
    drop(conn);

    std::fs::copy(&src, &dest)
        .map_err(|e| format!("Restore copy failed: {}", e))?;

    Ok("Database restored. Please restart the application.".into())
}

/// Get the path to the database file (for display in Settings).
#[tauri::command]
pub fn get_database_path() -> String {
    db_path().to_string_lossy().to_string()
}

/// Reset the database by deleting all user data while preserving the schema.
/// Settings are also wiped and will be repopulated with defaults on next load.
/// The app should be restarted after this operation.
#[tauri::command]
pub fn reset_database(db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute_batch(
        "
        PRAGMA foreign_keys = OFF;

        DELETE FROM audit_log;
        DELETE FROM import_logs;
        DELETE FROM stock_movements;
        DELETE FROM serial_numbers;
        DELETE FROM payment_schedules;
        DELETE FROM payments;
        DELETE FROM installment_accounts;
        DELETE FROM sale_items;
        DELETE FROM sales;
        DELETE FROM product_variants;
        DELETE FROM products;
        DELETE FROM customers;
        DELETE FROM categories;
        DELETE FROM settings;

        DELETE FROM sqlite_sequence WHERE name != 'schema_migrations';

        PRAGMA foreign_keys = ON;
        PRAGMA wal_checkpoint(TRUNCATE);
        ",
    )
    .map_err(|e| format!("Reset failed: {}", e))?;

    Ok("Database reset. Please restart the application.".into())
}

/// Insert demo seed data for development/testing.
/// Safe to call multiple times — skips if data already exists.
#[tauri::command]
pub fn seed_demo_data(db: State<'_, DbState>) -> Result<String, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    crate::db::seed::run(&conn).map_err(|e| e.to_string())?;
    Ok("Demo data seeded successfully".to_string())
}
