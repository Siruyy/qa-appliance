use rusqlite::Connection;
use std::fs;
use std::path::PathBuf;
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

    // Run migrations
    migrations::run(&conn).expect("Failed to run database migrations");

    println!("[db] Database initialised at {:?}", path);
    conn
}
