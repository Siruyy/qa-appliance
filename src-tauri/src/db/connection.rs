use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use super::migrations;

pub struct DbState(pub Mutex<Connection>);

/// Resolve the path to the SQLite database file.
pub fn db_path() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("QualityAppliance");
    base.join("quality_appliance.db")
}

/// Initialise and return a database connection with WAL mode and foreign keys enabled.
pub fn init() -> Connection {
    let path = db_path();

    // Ensure the parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).expect("Failed to create database directory");
    }

    let conn = Connection::open(&path).expect("Failed to open database");

    // Enable WAL mode for better concurrent read performance
    conn.execute_batch("PRAGMA journal_mode = WAL;")
        .expect("Failed to set WAL mode");

    // Enable foreign key constraints
    conn.execute_batch("PRAGMA foreign_keys = ON;")
        .expect("Failed to enable foreign keys");

    // Back up before applying any new migrations (no-op on fresh install)
    backup_if_needed(&conn, &path);

    // Run migrations
    migrations::run(&conn).expect("Failed to run database migrations");

    println!("[db] Database initialised at {:?}", path);
    conn
}

/// Creates a `VACUUM INTO` backup of the database before migrations run.
/// Only triggers when the stored schema version is behind LATEST_VERSION.
/// Skips on fresh installs (version 0 means no real data yet).
/// Skips if a backup for the current version already exists.
fn backup_if_needed(conn: &Connection, db_path: &Path) {
    // Query current version; if schema_migrations doesn't exist yet returns 0
    let current_version: i32 = conn
        .query_row(
            "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
            [],
            |r| r.get(0),
        )
        .unwrap_or(0);

    // Fresh install (0) — nothing to back up.
    // Already up-to-date — no migrations will run, nothing to back up.
    if current_version == 0 || current_version >= migrations::LATEST_VERSION {
        return;
    }

    let backup_path = db_path.with_file_name(format!(
        "quality_appliance_backup_v{}.db",
        current_version
    ));

    // Don't overwrite an existing backup for the same version
    if backup_path.exists() {
        println!(
            "[db] Pre-migration backup already exists at {:?}, skipping",
            backup_path
        );
        return;
    }

    // VACUUM INTO creates a clean, defragmented copy — safe on WAL-mode databases
    let sql = format!(
        "VACUUM INTO '{}'",
        backup_path.to_string_lossy().replace('\'', "\'\'")
    );
    match conn.execute_batch(&sql) {
        Ok(_) => println!("[db] Pre-migration backup saved to {:?}", backup_path),
        Err(e) => eprintln!("[db] Warning: pre-migration backup failed: {e}"),
    }
}
