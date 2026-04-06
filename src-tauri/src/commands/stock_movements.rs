use tauri::State;

use crate::db::connection::DbState;
use crate::models::stock_movement::StockMovement;

#[tauri::command]
pub fn get_stock_movements(
    db: State<'_, DbState>,
    variant_id: Option<i64>,
    product_id: Option<i64>,
    limit: Option<i64>,
) -> Result<Vec<StockMovement>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let limit_val = limit.unwrap_or(100).min(500);

    let (where_clause, params): (String, Vec<Box<dyn rusqlite::types::ToSql>>) =
        if let Some(vid) = variant_id {
            ("WHERE sm.variant_id = ?1".to_string(), vec![Box::new(vid)])
        } else if let Some(pid) = product_id {
            (
                "WHERE sm.variant_id IN (SELECT id FROM product_variants WHERE product_id = ?1)".to_string(),
                vec![Box::new(pid)],
            )
        } else {
            (String::new(), vec![])
        };

    let sql = format!(
        "SELECT sm.id, sm.variant_id,
                COALESCE(p.name, 'Unknown') AS product_name,
                COALESCE(pv.sku, '') || CASE WHEN pv.attributes IS NOT NULL AND pv.attributes != '' THEN ' - ' || pv.attributes ELSE '' END AS variant_label,
                sm.delta, sm.reason, sm.reference_type, sm.reference_id, sm.notes, sm.created_at
         FROM stock_movements sm
         LEFT JOIN product_variants pv ON pv.id = sm.variant_id
         LEFT JOIN products p ON p.id = pv.product_id
         {}
         ORDER BY sm.created_at DESC
         LIMIT {}",
        where_clause, limit_val
    );

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        params.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(StockMovement {
                id: row.get(0)?,
                variant_id: row.get(1)?,
                product_name: row.get(2)?,
                variant_label: row.get(3)?,
                delta: row.get(4)?,
                reason: row.get(5)?,
                reference_type: row.get(6)?,
                reference_id: row.get(7)?,
                notes: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for r in rows {
        result.push(r.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

/// Insert a stock movement record (called internally from other commands)
pub fn insert_stock_movement(
    conn: &rusqlite::Connection,
    variant_id: i64,
    delta: i64,
    reason: &str,
    reference_type: Option<&str>,
    reference_id: Option<&str>,
) -> Result<(), String> {
    conn.execute(
        "INSERT INTO stock_movements (variant_id, delta, reason, reference_type, reference_id)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![variant_id, delta, reason, reference_type, reference_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
