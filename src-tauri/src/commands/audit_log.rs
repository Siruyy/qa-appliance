use rusqlite::params;
use serde::Serialize;
use tauri::State;

use crate::db::connection::DbState;
use crate::models::PaginatedResult;

#[derive(Debug, Serialize)]
pub struct AuditEntry {
    pub id: i64,
    pub action: String,
    pub entity_type: String,
    pub entity_id: Option<i64>,
    pub details: Option<String>,
    pub created_at: String,
}

/// Insert an audit log entry (called from other commands, not a Tauri command).
pub fn insert_audit(
    conn: &rusqlite::Connection,
    action: &str,
    entity_type: &str,
    entity_id: Option<i64>,
    details: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params![action, entity_type, entity_id, details],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_audit_log(
    db: State<DbState>,
    page: Option<i64>,
    page_size: Option<i64>,
    action_filter: Option<String>,
    entity_type_filter: Option<String>,
) -> Result<PaginatedResult<AuditEntry>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let pg = page.unwrap_or(1).max(1);
    let ps = page_size.unwrap_or(50).clamp(1, 200);
    let offset = (pg - 1) * ps;

    let mut where_clauses = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref a) = action_filter {
        where_clauses.push(format!("action = ?{}", param_values.len() + 1));
        param_values.push(Box::new(a.clone()));
    }
    if let Some(ref e) = entity_type_filter {
        where_clauses.push(format!("entity_type = ?{}", param_values.len() + 1));
        param_values.push(Box::new(e.clone()));
    }

    let where_sql = if where_clauses.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", where_clauses.join(" AND "))
    };

    let count_sql = format!("SELECT COUNT(*) FROM audit_log {}", where_sql);
    let total: i64 = conn
        .query_row(&count_sql, rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())), |r| r.get(0))
        .map_err(|e| e.to_string())?;

    let data_sql = format!(
        "SELECT id, action, entity_type, entity_id, details, created_at FROM audit_log {} ORDER BY created_at DESC LIMIT ?{} OFFSET ?{}",
        where_sql,
        param_values.len() + 1,
        param_values.len() + 2,
    );

    param_values.push(Box::new(ps));
    param_values.push(Box::new(offset));

    let mut stmt = conn.prepare(&data_sql).map_err(|e| e.to_string())?;
    let entries = stmt
        .query_map(
            rusqlite::params_from_iter(param_values.iter().map(|p| p.as_ref())),
            |row| {
                Ok(AuditEntry {
                    id: row.get(0)?,
                    action: row.get(1)?,
                    entity_type: row.get(2)?,
                    entity_id: row.get(3)?,
                    details: row.get(4)?,
                    created_at: row.get(5)?,
                })
            },
        )
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(PaginatedResult {
        items: entries,
        total: total as u64,
    })
}
