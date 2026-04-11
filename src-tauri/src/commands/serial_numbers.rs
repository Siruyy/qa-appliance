use tauri::State;
use crate::db::connection::DbState;
use crate::models::serial_number::SerialNumber;

#[tauri::command]
pub fn get_serial_numbers(
    db: State<'_, DbState>,
    variant_id: i64,
    status: Option<String>,
) -> Result<Vec<SerialNumber>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let sql = match status.as_deref() {
        Some(_) =>
            "SELECT id, variant_id, serial_no, status, sale_item_id, added_at, sold_at, notes
             FROM serial_numbers WHERE variant_id = ?1 AND status = ?2
             ORDER BY added_at DESC".to_string(),
        None =>
            "SELECT id, variant_id, serial_no, status, sale_item_id, added_at, sold_at, notes
             FROM serial_numbers WHERE variant_id = ?1
             ORDER BY added_at DESC".to_string(),
    };

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let results = match status.as_deref() {
        Some(s) => stmt
            .query_map(rusqlite::params![variant_id, s], |row| {
                Ok(SerialNumber {
                    id: row.get(0)?,
                    variant_id: row.get(1)?,
                    serial_no: row.get(2)?,
                    status: row.get(3)?,
                    sale_item_id: row.get(4)?,
                    added_at: row.get(5)?,
                    sold_at: row.get(6)?,
                    notes: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?,
        None => stmt
            .query_map(rusqlite::params![variant_id], |row| {
                Ok(SerialNumber {
                    id: row.get(0)?,
                    variant_id: row.get(1)?,
                    serial_no: row.get(2)?,
                    status: row.get(3)?,
                    sale_item_id: row.get(4)?,
                    added_at: row.get(5)?,
                    sold_at: row.get(6)?,
                    notes: row.get(7)?,
                })
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?,
    };

    Ok(results)
}

#[tauri::command]
pub fn add_serial_numbers(
    db: State<'_, DbState>,
    variant_id: i64,
    serials: Vec<String>,
) -> Result<Vec<SerialNumber>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    for serial in &serials {
        let serial = serial.trim();
        if serial.is_empty() {
            continue;
        }
        conn.execute(
            "INSERT OR IGNORE INTO serial_numbers (variant_id, serial_no, status) VALUES (?1, ?2, 'in_stock')",
            rusqlite::params![variant_id, serial],
        )
        .map_err(|e| format!("Failed to insert serial '{}': {}", serial, e))?;
    }

    // Return all in_stock serials for this variant
    let mut stmt = conn
        .prepare(
            "SELECT id, variant_id, serial_no, status, sale_item_id, added_at, sold_at, notes
             FROM serial_numbers WHERE variant_id = ?1 AND status = 'in_stock'
             ORDER BY added_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let results = stmt
        .query_map(rusqlite::params![variant_id], |row| {
            Ok(SerialNumber {
                id: row.get(0)?,
                variant_id: row.get(1)?,
                serial_no: row.get(2)?,
                status: row.get(3)?,
                sale_item_id: row.get(4)?,
                added_at: row.get(5)?,
                sold_at: row.get(6)?,
                notes: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(results)
}

#[tauri::command]
pub fn delete_serial_number(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Only allow deleting in_stock serials
    let affected = conn
        .execute(
            "DELETE FROM serial_numbers WHERE id = ?1 AND status = 'in_stock'",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

    if affected == 0 {
        return Err("Serial number not found or already sold".to_string());
    }

    Ok(())
}
