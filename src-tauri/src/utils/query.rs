use rusqlite::Connection;
use crate::models::PaginatedResult;

/// Build a WHERE clause from a list of conditions.
pub fn build_where(conditions: &[String]) -> String {
    if conditions.is_empty() {
        String::new()
    } else {
        format!(" WHERE {}", conditions.join(" AND "))
    }
}

/// Execute a paginated query pair (COUNT + data) with shared parameters.
///
/// - `count_sql`: full SELECT COUNT(...) query (without LIMIT/OFFSET)
/// - `data_sql`:  full SELECT ... query (without LIMIT/OFFSET), including ORDER BY
/// - `params`:    shared parameter slice for both queries
/// - `limit`/`offset`: pagination bounds
/// - `map_row`:   closure to map each row into `T`
pub fn paginated_query<T, F>(
    conn: &Connection,
    count_sql: &str,
    data_sql: &str,
    params: &[&dyn rusqlite::types::ToSql],
    limit: Option<u32>,
    offset: Option<u32>,
    map_row: F,
) -> Result<PaginatedResult<T>, String>
where
    T: serde::Serialize,
    F: FnMut(&rusqlite::Row) -> Result<T, rusqlite::Error>,
{
    let total: u64 = conn
        .query_row(count_sql, params, |row| row.get(0))
        .unwrap_or(0);

    let full_sql = match limit {
        Some(l) => format!("{} LIMIT {} OFFSET {}", data_sql, l, offset.unwrap_or(0)),
        None => data_sql.to_string(),
    };

    let mut stmt = conn
        .prepare(&full_sql)
        .map_err(|e| format!("Prepare error: {}", e))?;

    let rows = stmt
        .query_map(params, map_row)
        .map_err(|e| format!("Query error: {}", e))?;

    let items: Vec<T> = rows
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row read error: {}", e))?;

    Ok(PaginatedResult { items, total })
}
