use crate::db::connection::DbState;
use crate::models::import_export::*;
use crate::utils::date::{add_months_to_date, today_iso};
use calamine::{open_workbook, Reader, Xlsx};
use rusqlite::params;
use std::collections::HashMap;
use std::io::BufRead;
use tauri::State;

// ── Helper: parse attributes JSON for color/size ─────

fn parse_attr(attributes: &Option<String>) -> (Option<String>, Option<String>) {
    match attributes {
        Some(json_str) => {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
                let color = val.get("color").and_then(|v| v.as_str()).map(|s| s.to_string());
                let size = val.get("size").and_then(|v| v.as_str()).map(|s| s.to_string());
                (color, size)
            } else {
                (None, None)
            }
        }
        None => (None, None),
    }
}

// ── Export Helpers (take &Connection for reuse) ──────

fn query_products(db: &rusqlite::Connection) -> Result<Vec<ExportProduct>, String> {
    let mut stmt = db.prepare(
        "SELECT c.name AS category, p.name AS product_name, pv.attributes,
                pv.sku, pv.cost_price, pv.selling_price, pv.stock_qty,
                pv.low_stock_threshold, pv.is_active
         FROM product_variants pv
         JOIN products p ON pv.product_id = p.id
         JOIN categories c ON p.category_id = c.id
         ORDER BY c.name, p.name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![], |row| {
        let attributes: Option<String> = row.get(2)?;
        let (color, size) = parse_attr(&attributes);
        let is_active_int: i64 = row.get(8)?;
        Ok(ExportProduct {
            category: row.get(0)?,
            product_name: row.get(1)?,
            variant_color: color,
            variant_size: size,
            sku: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            cost_price: row.get(4)?,
            selling_price: row.get(5)?,
            stock_quantity: row.get(6)?,
            low_stock_threshold: row.get(7)?,
            is_active: is_active_int != 0,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_categories(db: &rusqlite::Connection) -> Result<Vec<ExportCategory>, String> {
    let mut stmt = db.prepare(
        "SELECT id, name, description FROM categories ORDER BY name"
    ).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params![], |row| {
        Ok(ExportCategory {
            id: row.get(0)?,
            name: row.get(1)?,
            description: row.get(2)?,
        })
    }).map_err(|e| e.to_string())?;
    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_customers(db: &rusqlite::Connection) -> Result<Vec<ExportCustomer>, String> {
    let mut stmt = db.prepare(
        "SELECT id, name, phone, address, notes, is_active, created_at
         FROM customers ORDER BY name"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![], |row| {
        let is_active_int: i64 = row.get(5)?;
        Ok(ExportCustomer {
            id: row.get(0)?,
            name: row.get(1)?,
            phone: row.get(2)?,
            address: row.get(3)?,
            notes: row.get(4)?,
            is_active: is_active_int != 0,
            created_at: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_sales(db: &rusqlite::Connection) -> Result<Vec<ExportSale>, String> {
    let mut stmt = db.prepare(
        "SELECT s.id, s.sale_date,
                COALESCE(cu.name, 'Walk-in') AS customer_name,
                GROUP_CONCAT(p.name || ' - ' || COALESCE(pv.sku, 'N/A'), ', ') AS items_summary,
                s.total, s.discount_type, s.discount_value, s.discount,
                s.payment_type,
                (SELECT ia.down_payment FROM installment_accounts ia WHERE ia.sale_id = s.id LIMIT 1),
                s.status
         FROM sales s
         LEFT JOIN customers cu ON s.customer_id = cu.id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON si.variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         GROUP BY s.id
         ORDER BY s.sale_date DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![], |row| {
        Ok(ExportSale {
            id: row.get(0)?,
            sale_date: row.get(1)?,
            customer_name: row.get(2)?,
            items_summary: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            total_amount: row.get(4)?,
            discount_type: row.get::<_, Option<String>>(5)?.unwrap_or_else(|| "peso".to_string()),
            discount_value: row.get::<_, Option<f64>>(6)?.unwrap_or(0.0),
            discount: row.get::<_, Option<f64>>(7)?.unwrap_or(0.0),
            payment_type: row.get(8)?,
            down_payment: row.get(9)?,
            status: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_accounts(db: &rusqlite::Connection) -> Result<Vec<ExportAccount>, String> {
    let mut stmt = db.prepare(
        "SELECT ia.id, cu.name AS customer_name,
                GROUP_CONCAT(p.name || ' - ' || COALESCE(pv.sku, 'N/A'), ', ') AS product_summary,
                ia.principal, ia.balance_remaining, ia.interest_rate, ia.penalty_rate,
                ia.rebate_rate, ia.term_months, ia.has_schedule, ia.status, ia.created_at
         FROM installment_accounts ia
         JOIN customers cu ON ia.customer_id = cu.id
         JOIN sales s ON ia.sale_id = s.id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON si.variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         GROUP BY ia.id
         ORDER BY ia.created_at DESC"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![], |row| {
        let has_schedule_int: i64 = row.get(9)?;
        Ok(ExportAccount {
            id: row.get(0)?,
            customer_name: row.get(1)?,
            product_summary: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            principal: row.get(3)?,
            balance_remaining: row.get(4)?,
            interest_rate: row.get(5)?,
            penalty_rate: row.get(6)?,
            rebate_rate: row.get::<_, Option<f64>>(7)?.unwrap_or(0.0),
            term_months: row.get(8)?,
            has_schedule: has_schedule_int != 0,
            status: row.get(10)?,
            created_at: row.get(11)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_payments(
    db: &rusqlite::Connection,
    from_date: Option<&str>,
    to_date: Option<&str>,
) -> Result<Vec<ExportPayment>, String> {
    let mut sql = String::from(
        "SELECT py.id, py.payment_date, cu.name AS customer_name,
                GROUP_CONCAT(p.name || ' - ' || COALESCE(pv.sku, 'N/A'), ', ') AS product_summary,
                py.amount, py.type, py.notes
         FROM payments py
         JOIN installment_accounts ia ON py.account_id = ia.id
         JOIN customers cu ON ia.customer_id = cu.id
         JOIN sales s ON ia.sale_id = s.id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants pv ON si.variant_id = pv.id
         LEFT JOIN products p ON pv.product_id = p.id
         WHERE 1=1"
    );

    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(fd) = from_date {
        sql.push_str(" AND py.payment_date >= ?");
        params.push(Box::new(fd.to_string()));
    }
    if let Some(td) = to_date {
        sql.push_str(" AND py.payment_date <= ?");
        params.push(Box::new(format!("{}T23:59:59", td)));
    }

    sql.push_str(" GROUP BY py.id ORDER BY py.payment_date DESC");

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = db.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(param_refs.as_slice(), |row| {
        Ok(ExportPayment {
            id: row.get(0)?,
            payment_date: row.get(1)?,
            customer_name: row.get(2)?,
            product_summary: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
            amount: row.get(4)?,
            payment_type: row.get(5)?,
            notes: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

// ── Export Commands (delegate to helpers) ─────────────

#[tauri::command]
pub fn export_products_data(state: State<'_, DbState>) -> Result<Vec<ExportProduct>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    query_products(&db)
}

#[tauri::command]
pub fn export_customers_data(state: State<'_, DbState>) -> Result<Vec<ExportCustomer>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    query_customers(&db)
}

#[tauri::command]
pub fn export_sales_data(state: State<'_, DbState>) -> Result<Vec<ExportSale>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    query_sales(&db)
}

#[tauri::command]
pub fn export_accounts_data(state: State<'_, DbState>) -> Result<Vec<ExportAccount>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    query_accounts(&db)
}

#[tauri::command]
pub fn export_payments_data(
    state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<ExportPayment>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    query_payments(&db, from_date.as_deref(), to_date.as_deref())
}

#[tauri::command]
pub fn export_all_data(state: State<'_, DbState>) -> Result<ExportAllData, String> {
    let mut db = state.0.lock().map_err(|e| e.to_string())?;

    // Use a transaction for a consistent snapshot across all queries
    let tx = db.transaction().map_err(|e| e.to_string())?;

    let categories = query_categories(&tx)?;
    let products = query_products(&tx)?;
    let customers = query_customers(&tx)?;
    let sales = query_sales(&tx)?;
    let accounts = query_accounts(&tx)?;
    let payments = query_payments(&tx, None, None)?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ExportAllData {
        products,
        categories,
        customers,
        sales,
        accounts,
        payments,
    })
}

// ── Import Helpers ───────────────────────────────────

fn read_import_rows(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    if file_path.ends_with(".csv") {
        read_csv_rows(file_path)
    } else {
        read_excel_rows(file_path)
    }
}

fn read_csv_rows(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let file = std::fs::File::open(file_path).map_err(|e| format!("Cannot open file: {}", e))?;
    let reader = std::io::BufReader::new(file);
    let mut lines = reader.lines();

    let header_line = lines.next().ok_or("File is empty")?.map_err(|e| format!("Read error: {}", e))?;
    let headers: Vec<String> = parse_csv_line(&header_line)
        .iter()
        .map(|s| s.trim().to_lowercase())
        .collect();

    let mut data_rows = Vec::new();
    for line_result in lines {
        let line = line_result.map_err(|e| format!("Read error: {}", e))?;
        let values = parse_csv_line(&line);
        if values.iter().all(|v| v.is_empty()) {
            continue;
        }
        data_rows.push(values);
    }

    Ok((headers, data_rows))
}

fn parse_csv_line(line: &str) -> Vec<String> {
    let mut fields = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;
    let mut chars = line.chars().peekable();

    while let Some(ch) = chars.next() {
        if in_quotes {
            if ch == '"' {
                if chars.peek() == Some(&'"') {
                    current.push('"');
                    chars.next();
                } else {
                    in_quotes = false;
                }
            } else {
                current.push(ch);
            }
        } else if ch == '"' {
            in_quotes = true;
        } else if ch == ',' {
            fields.push(current.trim().to_string());
            current = String::new();
        } else {
            current.push(ch);
        }
    }
    fields.push(current.trim().to_string());
    fields
}

fn read_excel_rows(file_path: &str) -> Result<(Vec<String>, Vec<Vec<String>>), String> {
    let mut workbook: Xlsx<_> = open_workbook(file_path).map_err(|e| format!("Cannot open file: {}", e))?;

    let sheet_name = workbook
        .sheet_names()
        .first()
        .cloned()
        .ok_or_else(|| "No sheets found in workbook".to_string())?;

    let range = workbook
        .worksheet_range(&sheet_name)
        .map_err(|e| format!("Cannot read sheet: {}", e))?;

    let mut rows_iter = range.rows();

    // First row = headers
    let headers: Vec<String> = match rows_iter.next() {
        Some(row) => row.iter().map(|c| c.to_string().trim().to_lowercase()).collect(),
        None => return Err("File is empty".to_string()),
    };

    // Remaining rows
    let mut data_rows = Vec::new();
    for row in rows_iter {
        let values: Vec<String> = row.iter().map(|c| c.to_string().trim().to_string()).collect();
        // Skip completely empty rows
        if values.iter().all(|v| v.is_empty()) {
            continue;
        }
        data_rows.push(values);
    }

    Ok((headers, data_rows))
}

fn row_to_map(headers: &[String], values: &[String]) -> HashMap<String, String> {
    let mut map = HashMap::new();
    for (i, header) in headers.iter().enumerate() {
        let val = values.get(i).cloned().unwrap_or_default();
        map.insert(header.clone(), val);
    }
    map
}

fn get_field(data: &HashMap<String, String>, key: &str) -> String {
    data.get(key).cloned().unwrap_or_default().trim().to_string()
}

// ── Preview Import ───────────────────────────────────

#[tauri::command]
pub fn preview_import(
    state: State<'_, DbState>,
    import_type: String,
    file_path: String,
) -> Result<ImportPreview, String> {
    let (headers, data_rows) = read_import_rows(&file_path)?;

    match import_type.as_str() {
        "products" => preview_products(&state, &headers, &data_rows),
        "customers" => preview_customers(&state, &headers, &data_rows),
        "balances" => preview_balances(&state, &headers, &data_rows),
        _ => Err(format!("Unknown import type: {}", import_type)),
    }
}

fn preview_products(
    _state: &State<'_, DbState>,
    headers: &[String],
    data_rows: &[Vec<String>],
) -> Result<ImportPreview, String> {
    let mut valid = Vec::new();
    let mut errors = Vec::new();

    for (i, row) in data_rows.iter().enumerate() {
        let data = row_to_map(headers, row);
        let row_number = i + 2; // 1-indexed, +1 for header
        let mut row_errors = Vec::new();

        let category = get_field(&data, "category");
        let product_name = get_field(&data, "product_name");
        let cost_price = get_field(&data, "cost_price");
        let selling_price = get_field(&data, "selling_price");
        let stock_qty = get_field(&data, "stock_qty");

        if category.is_empty() { row_errors.push("category is required".to_string()); }
        if product_name.is_empty() { row_errors.push("product_name is required".to_string()); }
        if cost_price.parse::<f64>().is_err() || cost_price.parse::<f64>().unwrap_or(-1.0) < 0.0 {
            row_errors.push("cost_price must be a non-negative number".to_string());
        }
        if selling_price.parse::<f64>().is_err() || selling_price.parse::<f64>().unwrap_or(-1.0) < 0.0 {
            row_errors.push("selling_price must be a non-negative number".to_string());
        }
        if stock_qty.parse::<i64>().is_err() || stock_qty.parse::<i64>().unwrap_or(-1) < 0 {
            row_errors.push("stock_qty must be a non-negative integer".to_string());
        }

        if row_errors.is_empty() {
            valid.push(ImportValidRow { row_number, data });
        } else {
            errors.push(ImportErrorRow { row_number, data, errors: row_errors });
        }
    }

    Ok(ImportPreview { valid_rows: valid, error_rows: errors, skip_rows: Vec::new() })
}

fn preview_customers(
    state: &State<'_, DbState>,
    headers: &[String],
    data_rows: &[Vec<String>],
) -> Result<ImportPreview, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut valid = Vec::new();
    let mut errors = Vec::new();
    let mut skips = Vec::new();

    for (i, row) in data_rows.iter().enumerate() {
        let data = row_to_map(headers, row);
        let row_number = i + 2;
        let mut row_errors = Vec::new();
        let name = get_field(&data, "name");

        if name.is_empty() {
            errors.push(ImportErrorRow {
                row_number,
                data,
                errors: vec!["name is required".to_string()],
            });
            continue;
        }

        // Validate phone format if provided
        let phone = get_field(&data, "phone");
        if !phone.is_empty() {
            let digits: String = phone.chars().filter(|c| c.is_ascii_digit()).collect();
            if digits.len() < 7 || digits.len() > 13 {
                row_errors.push("phone must be 7-13 digits".to_string());
            }
        }

        if !row_errors.is_empty() {
            errors.push(ImportErrorRow { row_number, data, errors: row_errors });
            continue;
        }

        // Check for duplicate
        let existing: bool = if phone.is_empty() {
            db.query_row(
                "SELECT COUNT(*) > 0 FROM customers WHERE name = ?1",
                params![name],
                |row| row.get(0),
            ).unwrap_or(false)
        } else {
            db.query_row(
                "SELECT COUNT(*) > 0 FROM customers WHERE name = ?1 AND phone = ?2",
                params![name, phone],
                |row| row.get(0),
            ).unwrap_or(false)
        };

        if existing {
            skips.push(ImportSkipRow { row_number, data, reason: "Duplicate customer".to_string() });
        } else {
            valid.push(ImportValidRow { row_number, data });
        }
    }

    Ok(ImportPreview { valid_rows: valid, error_rows: errors, skip_rows: skips })
}

fn preview_balances(
    _state: &State<'_, DbState>,
    headers: &[String],
    data_rows: &[Vec<String>],
) -> Result<ImportPreview, String> {
    let mut valid = Vec::new();
    let mut errors = Vec::new();

    for (i, row) in data_rows.iter().enumerate() {
        let data = row_to_map(headers, row);
        let row_number = i + 2;
        let mut row_errors = Vec::new();

        let customer_name = get_field(&data, "customer_name");
        let product_description = get_field(&data, "product_description");
        let original_amount = get_field(&data, "original_amount");
        let balance_remaining = get_field(&data, "balance_remaining");

        if customer_name.is_empty() { row_errors.push("customer_name is required".to_string()); }
        if product_description.is_empty() { row_errors.push("product_description is required".to_string()); }

        let orig_val = original_amount.parse::<f64>().unwrap_or(-1.0);
        let bal_val = balance_remaining.parse::<f64>().unwrap_or(-1.0);

        if orig_val < 0.0 { row_errors.push("original_amount must be a valid number".to_string()); }
        if bal_val < 0.0 { row_errors.push("balance_remaining must be a valid number".to_string()); }
        if orig_val >= 0.0 && bal_val >= 0.0 && bal_val > orig_val {
            row_errors.push("balance_remaining cannot exceed original_amount".to_string());
        }

        // All imported accounts are scheduled — term_months is required
        let term = get_field(&data, "term_months");
        if term.parse::<i64>().unwrap_or(0) <= 0 {
            row_errors.push("term_months is required".to_string());
        }

        // Validate interest_rate and penalty_rate ranges
        let interest = get_field(&data, "interest_rate");
        if !interest.is_empty() {
            let v = interest.parse::<f64>().unwrap_or(-1.0);
            if v < 0.0 || v > 100.0 {
                row_errors.push("interest_rate must be between 0 and 100".to_string());
            }
        }
        let penalty = get_field(&data, "penalty_rate");
        if !penalty.is_empty() {
            let v = penalty.parse::<f64>().unwrap_or(-1.0);
            if v < 0.0 || v > 100.0 {
                row_errors.push("penalty_rate must be between 0 and 100".to_string());
            }
        }

        if row_errors.is_empty() {
            valid.push(ImportValidRow { row_number, data });
        } else {
            errors.push(ImportErrorRow { row_number, data, errors: row_errors });
        }
    }

    Ok(ImportPreview { valid_rows: valid, error_rows: errors, skip_rows: Vec::new() })
}

// ── Confirm Import ───────────────────────────────────

#[tauri::command]
pub fn confirm_import(
    state: State<'_, DbState>,
    import_type: String,
    file_path: String,
) -> Result<ImportResult, String> {
    // Re-run preview to get valid rows
    let preview = preview_import(state.clone(), import_type.clone(), file_path.clone())?;

    let mut db = state.0.lock().map_err(|e| e.to_string())?;
    let skipped = preview.skip_rows.len() as i64;
    let errored = preview.error_rows.len() as i64;

    // Run all inserts inside a transaction so partial failures roll back
    let tx = db.transaction().map_err(|e| e.to_string())?;
    let mut added: i64 = 0;
    let mut imported_ids: Vec<i64> = Vec::new();
    let mut runtime_errors: Vec<String> = Vec::new();

    match import_type.as_str() {
        "products" => {
            for row in &preview.valid_rows {
                match import_product_row(&tx, &row.data) {
                    Ok(id) => { imported_ids.push(id); added += 1; }
                    Err(e) => { runtime_errors.push(format!("Row {}: {}", row.row_number, e)); }
                }
            }
        }
        "customers" => {
            for row in &preview.valid_rows {
                match import_customer_row(&tx, &row.data) {
                    Ok(id) => { imported_ids.push(id); added += 1; }
                    Err(e) => { runtime_errors.push(format!("Row {}: {}", row.row_number, e)); }
                }
            }
        }
        "balances" => {
            for row in &preview.valid_rows {
                match import_balance_row(&tx, &row.data) {
                    Ok(id) => { imported_ids.push(id); added += 1; }
                    Err(e) => { runtime_errors.push(format!("Row {}: {}", row.row_number, e)); }
                }
            }
        }
        _ => return Err(format!("Unknown import type: {}", import_type)),
    }

    if !runtime_errors.is_empty() && added == 0 {
        // All rows failed — rollback
        tx.rollback().map_err(|e| e.to_string())?;
        return Err(format!("All rows failed: {}", runtime_errors.join("; ")));
    }

    // Record in import_logs (inside the same transaction)
    let filename = file_path.rsplit('/').next()
        .and_then(|s| s.rsplit('\\').next())
        .unwrap_or(&file_path)
        .to_string();

    let mut all_error_details: Vec<serde_json::Value> = preview.error_rows.iter().map(|e| {
        serde_json::json!({ "row": e.row_number, "message": e.errors.join("; ") })
    }).collect();
    for re in &runtime_errors {
        all_error_details.push(serde_json::json!({ "runtime": re }));
    }
    let error_details = if all_error_details.is_empty() {
        None
    } else {
        Some(serde_json::to_string(&all_error_details).unwrap_or_default())
    };

    let ids_json = serde_json::to_string(&imported_ids).unwrap_or_default();

    tx.execute(
        "INSERT INTO import_logs (import_type, filename, rows_added, rows_skipped, rows_errored, error_details, imported_ids)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![import_type, filename, added, skipped, errored + runtime_errors.len() as i64, error_details, ids_json],
    ).map_err(|e| e.to_string())?;

    let _ = tx.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["import", &import_type, 0, format!("Imported {} (added={}, skipped={}, errors={})", filename, added, skipped, errored)],
    );

    tx.commit().map_err(|e| e.to_string())?;

    Ok(ImportResult { rows_added: added, rows_skipped: skipped, rows_errored: errored })
}

fn import_product_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<i64, String> {
    let category_name = get_field(data, "category");
    let product_name = get_field(data, "product_name");
    let brand = get_field(data, "brand");
    let model = get_field(data, "model");
    let description = get_field(data, "description");
    let variant_color = get_field(data, "variant_color");
    let variant_size = get_field(data, "variant_size");
    let sku = get_field(data, "sku");
    let cost_price: f64 = get_field(data, "cost_price").parse().unwrap_or(0.0);
    let selling_price: f64 = get_field(data, "selling_price").parse().unwrap_or(0.0);
    let stock_qty: i64 = get_field(data, "stock_qty").parse().unwrap_or(0);
    let threshold: i64 = get_field(data, "low_stock_threshold").parse().unwrap_or(2);

    // Find or create category
    let category_id: i64 = match db.query_row(
        "SELECT id FROM categories WHERE name = ?1",
        params![category_name],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => {
            db.execute("INSERT INTO categories (name) VALUES (?1)", params![category_name])
                .map_err(|e| e.to_string())?;
            db.last_insert_rowid()
        }
    };

    // Find or create product (with optional brand/model/description)
    let product_id: i64 = match db.query_row(
        "SELECT id FROM products WHERE category_id = ?1 AND name = ?2",
        params![category_id, product_name],
        |row| row.get(0),
    ) {
        Ok(id) => {
            // Update brand/model/description if provided
            if !brand.is_empty() || !model.is_empty() || !description.is_empty() {
                let brand_opt = if brand.is_empty() { None } else { Some(brand) };
                let model_opt = if model.is_empty() { None } else { Some(model) };
                let desc_opt = if description.is_empty() { None } else { Some(description) };
                db.execute(
                    "UPDATE products SET
                     brand = COALESCE(?1, brand),
                     model = COALESCE(?2, model),
                     description = COALESCE(?3, description),
                     updated_at = datetime('now')
                     WHERE id = ?4",
                    params![brand_opt, model_opt, desc_opt, id],
                ).map_err(|e| e.to_string())?;
            }
            id
        }
        Err(_) => {
            let brand_opt = if brand.is_empty() { None } else { Some(brand) };
            let model_opt = if model.is_empty() { None } else { Some(model) };
            let desc_opt = if description.is_empty() { None } else { Some(description) };
            db.execute(
                "INSERT INTO products (category_id, name, brand, model, description) VALUES (?1, ?2, ?3, ?4, ?5)",
                params![category_id, product_name, brand_opt, model_opt, desc_opt],
            ).map_err(|e| e.to_string())?;
            db.last_insert_rowid()
        }
    };

    // Build attributes JSON
    let mut attrs = serde_json::Map::new();
    if !variant_color.is_empty() {
        attrs.insert("color".to_string(), serde_json::Value::String(variant_color.clone()));
    }
    if !variant_size.is_empty() {
        attrs.insert("size".to_string(), serde_json::Value::String(variant_size.clone()));
    }
    let attrs_json = if attrs.is_empty() { None } else { Some(serde_json::to_string(&attrs).map_err(|e| format!("Failed to serialize attributes: {}", e))?) };

    // Find existing variant by product_id + attributes
    let existing_variant: Option<i64> = db.query_row(
        "SELECT id FROM product_variants WHERE product_id = ?1 AND COALESCE(attributes, '') = COALESCE(?2, '')",
        params![product_id, attrs_json],
        |row| row.get(0),
    ).ok();

    if let Some(variant_id) = existing_variant {
        // Update existing
        db.execute(
            "UPDATE product_variants SET cost_price = ?1, selling_price = ?2, stock_qty = ?3,
             low_stock_threshold = ?4, sku = COALESCE(NULLIF(?5, ''), sku),
             updated_at = datetime('now') WHERE id = ?6",
            params![cost_price, selling_price, stock_qty, threshold, sku, variant_id],
        ).map_err(|e| e.to_string())?;
        Ok(variant_id)
    } else {
        // Insert new
        let sku_val = if sku.is_empty() { None } else { Some(sku) };
        db.execute(
            "INSERT INTO product_variants (product_id, sku, attributes, cost_price, selling_price, stock_qty, low_stock_threshold)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![product_id, sku_val, attrs_json, cost_price, selling_price, stock_qty, threshold],
        ).map_err(|e| e.to_string())?;
        Ok(db.last_insert_rowid())
    }
}

fn import_customer_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<i64, String> {
    let name = get_field(data, "name");
    let phone = {
        let v = get_field(data, "phone");
        if v.is_empty() { None } else { Some(v) }
    };
    let address = {
        let v = get_field(data, "address");
        if v.is_empty() { None } else { Some(v) }
    };
    let notes = {
        let v = get_field(data, "notes");
        if v.is_empty() { None } else { Some(v) }
    };

    db.execute(
        "INSERT INTO customers (name, phone, address, notes) VALUES (?1, ?2, ?3, ?4)",
        params![name, phone, address, notes],
    ).map_err(|e| e.to_string())?;

    Ok(db.last_insert_rowid())
}

fn import_balance_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<i64, String> {
    let customer_name = get_field(data, "customer_name");
    let customer_phone = get_field(data, "customer_phone");
    let product_description = get_field(data, "product_description");
    let original_amount: f64 = get_field(data, "original_amount").parse().unwrap_or(0.0);
    let balance_remaining: f64 = get_field(data, "balance_remaining").parse().unwrap_or(0.0);
    let interest_rate: f64 = get_field(data, "interest_rate").parse().unwrap_or(0.0);
    let penalty_rate: f64 = get_field(data, "penalty_rate").parse().unwrap_or(0.0);
    let has_schedule = true; // all accounts are scheduled
    let term_months: Option<i64> = get_field(data, "term_months").parse().ok();
    let monthly_amount: Option<f64> = get_field(data, "monthly_amount").parse().ok();
    let start_date = {
        let v = get_field(data, "start_date");
        if v.is_empty() { None } else { Some(v) }
    };
    let notes = {
        let v = get_field(data, "notes");
        if v.is_empty() { None } else { Some(v) }
    };

    // Find or create customer
    let customer_id: i64 = if !customer_phone.is_empty() {
        match db.query_row(
            "SELECT id FROM customers WHERE name = ?1 AND phone = ?2",
            params![customer_name, customer_phone],
            |row| row.get(0),
        ) {
            Ok(id) => id,
            Err(_) => {
                let phone_opt: Option<String> = Some(customer_phone);
                db.execute(
                    "INSERT INTO customers (name, phone) VALUES (?1, ?2)",
                    params![customer_name, phone_opt],
                ).map_err(|e| e.to_string())?;
                db.last_insert_rowid()
            }
        }
    } else {
        match db.query_row(
            "SELECT id FROM customers WHERE name = ?1",
            params![customer_name],
            |row| row.get(0),
        ) {
            Ok(id) => id,
            Err(_) => {
                db.execute(
                    "INSERT INTO customers (name) VALUES (?1)",
                    params![customer_name],
                ).map_err(|e| e.to_string())?;
                db.last_insert_rowid()
            }
        }
    };

    let down_payment = original_amount - balance_remaining;

    // Create synthetic sale
    let sale_notes = format!("Migrated from import: {}", product_description);
    db.execute(
        "INSERT INTO sales (customer_id, sale_date, subtotal, total, payment_type, status, notes)
         VALUES (?1, COALESCE(?2, datetime('now')), ?3, ?3, 'installment', 'completed', ?4)",
        params![customer_id, start_date, original_amount, sale_notes],
    ).map_err(|e| e.to_string())?;
    let sale_id = db.last_insert_rowid();

    // Create a synthetic sale_item so report joins don't miss this sale.
    // Use variant_id = 0 (no real variant) with the product description as context.
    db.execute(
        "INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price)
         VALUES (?1, 0, 1, ?2)",
        params![sale_id, original_amount],
    ).map_err(|e| e.to_string())?;

    // Create installment account
    db.execute(
        "INSERT INTO installment_accounts
         (sale_id, customer_id, principal, down_payment, interest_rate, penalty_rate,
          balance_remaining, has_schedule, term_months, monthly_amount, start_date, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            sale_id, customer_id, original_amount, down_payment,
            interest_rate, penalty_rate, balance_remaining,
            has_schedule as i64, term_months, monthly_amount,
            start_date, notes
        ],
    ).map_err(|e| e.to_string())?;
    let account_id = db.last_insert_rowid();

    // Always generate payment schedules
    {
        if let (Some(term), Some(monthly)) = (term_months, monthly_amount) {
            let base_date = start_date.clone().unwrap_or_else(|| {
                today_iso()
            });
            for month_idx in 1..=term {
                let due_date = add_months_to_date(&base_date, month_idx as u32)
                    .map_err(|e| e.to_string())?;
                db.execute(
                    "INSERT INTO payment_schedules (account_id, due_date, amount_due, status)
                     VALUES (?1, ?2, ?3, 'pending')",
                    params![account_id, due_date, monthly],
                ).map_err(|e| e.to_string())?;
            }
        }
    }

    // Record down payment if any
    if down_payment > 0.0 {
        db.execute(
            "INSERT INTO payments (account_id, amount, payment_date, type, notes)
             VALUES (?1, ?2, COALESCE(?3, datetime('now')), 'down_payment', 'Migrated down payment')",
            params![account_id, down_payment, start_date],
        ).map_err(|e| e.to_string())?;
    }

    Ok(account_id)
}

// ── Template Download ───────────────────────────────

#[tauri::command]
pub fn get_import_template_columns(import_type: String) -> Result<Vec<String>, String> {
    match import_type.as_str() {
        "products" => Ok(vec![
            "category".into(), "product_name".into(), "brand".into(), "model".into(),
            "description".into(), "variant_color".into(), "variant_size".into(), "sku".into(),
            "cost_price".into(), "selling_price".into(), "stock_qty".into(), "low_stock_threshold".into(),
        ]),
        "customers" => Ok(vec![
            "name".into(), "phone".into(), "address".into(), "notes".into(),
        ]),
        "balances" => Ok(vec![
            "customer_name".into(), "customer_phone".into(), "product_description".into(),
            "original_amount".into(), "balance_remaining".into(), "interest_rate".into(),
            "penalty_rate".into(), "term_months".into(), "monthly_amount".into(),
            "start_date".into(), "notes".into(),
        ]),
        _ => Err(format!("Unknown import type: {}", import_type)),
    }
}

#[tauri::command]
pub fn generate_import_template(import_type: String, file_path: String) -> Result<(), String> {
    use rust_xlsxwriter::{Workbook, Format, Color};

    let columns = get_import_template_columns(import_type.clone())?;
    let example = get_import_example_row(&import_type)?;

    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    worksheet.set_name(&import_type).map_err(|e| e.to_string())?;

    let header_fmt = Format::new().set_bold();
    let example_fmt = Format::new()
        .set_font_color(Color::RGB(0x6B7280))
        .set_italic();

    for (col, name) in columns.iter().enumerate() {
        worksheet
            .write_string_with_format(0, col as u16, name, &header_fmt)
            .map_err(|e| e.to_string())?;

        // Example row
        if col < example.len() {
            worksheet
                .write_string_with_format(1, col as u16, &example[col], &example_fmt)
                .map_err(|e| e.to_string())?;
        }

        // Column width based on longest of header or example value
        let ex_len = if col < example.len() { example[col].len() as f64 } else { 0.0 };
        let width = (name.len() as f64).max(ex_len).max(12.0) + 2.0;
        worksheet.set_column_width(col as u16, width).map_err(|e| e.to_string())?;
    }

    workbook.save(&file_path).map_err(|e| format!("Failed to save template: {}", e))?;
    Ok(())
}

fn get_import_example_row(import_type: &str) -> Result<Vec<String>, String> {
    let row: Vec<&str> = match import_type {
        "products" => vec![
            "Refrigerators",     // category
            "Samsung Inverter",  // product_name
            "Samsung",           // brand
            "RT35CG5444",        // model
            "Digital Inverter Refrigerator", // description
            "Silver",            // variant_color
            "350L",              // variant_size
            "REF-SAM-001",       // sku
            "18500",             // cost_price
            "24990",             // selling_price
            "5",                 // stock_qty
            "2",                 // low_stock_threshold
        ],
        "customers" => vec![
            "Juan Dela Cruz",    // name
            "09171234567",       // phone
            "123 Rizal St, Quezon City", // address
            "Regular customer",  // notes
        ],
        "balances" => vec![
            "Juan Dela Cruz",    // customer_name
            "09171234567",       // customer_phone
            "Samsung Inverter Ref - Silver 350L", // product_description
            "24990",             // original_amount
            "18500",             // balance_remaining
            "3.5",               // interest_rate (%)
            "5",                 // penalty_rate (%)
            "12",                // term_months
            "2200",              // monthly_amount
            "2025-01-15",        // start_date
            "Transferred from old ledger", // notes
        ],
        _ => return Err(format!("Unknown import type: {}", import_type)),
    };
    Ok(row.into_iter().map(|s| s.to_string()).collect())
}

// ── Undo Import ─────────────────────────────────────

#[tauri::command]
pub fn undo_import(state: State<'_, DbState>, import_log_id: i64) -> Result<String, String> {
    let mut db = state.0.lock().map_err(|e| e.to_string())?;

    // Read the import log entry
    let (import_type, imported_ids_json): (String, Option<String>) = db.query_row(
        "SELECT import_type, imported_ids FROM import_logs WHERE id = ?1",
        params![import_log_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    ).map_err(|e| format!("Import log not found: {}", e))?;

    let imported_ids: Vec<i64> = match &imported_ids_json {
        Some(json) => serde_json::from_str(json).unwrap_or_default(),
        None => return Err("This import has no tracked IDs and cannot be undone".to_string()),
    };

    if imported_ids.is_empty() {
        return Err("No imported records to undo".to_string());
    }

    let tx = db.transaction().map_err(|e| e.to_string())?;
    let mut removed = 0;

    match import_type.as_str() {
        "products" => {
            // IDs are variant IDs — soft delete them
            for id in &imported_ids {
                let changed = tx.execute(
                    "UPDATE product_variants SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
                    params![id],
                ).unwrap_or(0);
                removed += changed;
            }
        }
        "customers" => {
            for id in &imported_ids {
                // Only soft-delete if customer has no sales
                let has_sales: bool = tx.query_row(
                    "SELECT COUNT(*) > 0 FROM sales WHERE customer_id = ?1",
                    params![id],
                    |row| row.get(0),
                ).unwrap_or(true);

                if has_sales {
                    let changed = tx.execute(
                        "UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
                        params![id],
                    ).unwrap_or(0);
                    removed += changed;
                } else {
                    let changed = tx.execute("DELETE FROM customers WHERE id = ?1", params![id]).unwrap_or(0);
                    removed += changed;
                }
            }
        }
        "balances" => {
            // IDs are account IDs — remove entire chain (payments, schedules, account, sale_items, sale)
            for id in &imported_ids {
                let sale_id: Option<i64> = tx.query_row(
                    "SELECT sale_id FROM installment_accounts WHERE id = ?1",
                    params![id],
                    |row| row.get(0),
                ).ok();

                tx.execute("DELETE FROM payments WHERE account_id = ?1", params![id]).ok();
                tx.execute("DELETE FROM payment_schedules WHERE account_id = ?1", params![id]).ok();
                tx.execute("DELETE FROM installment_accounts WHERE id = ?1", params![id]).ok();

                if let Some(sid) = sale_id {
                    tx.execute("DELETE FROM sale_items WHERE sale_id = ?1", params![sid]).ok();
                    tx.execute("DELETE FROM sales WHERE id = ?1", params![sid]).ok();
                }
                removed += 1;
            }
        }
        _ => {
            tx.rollback().map_err(|e| e.to_string())?;
            return Err(format!("Unknown import type: {}", import_type));
        }
    }

    // Mark import log as undone
    tx.execute(
        "UPDATE import_logs SET rows_added = 0, error_details = COALESCE(error_details || ' [UNDONE]', '[UNDONE]') WHERE id = ?1",
        params![import_log_id],
    ).map_err(|e| e.to_string())?;

    let _ = tx.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        params!["undo_import", &import_type, import_log_id, format!("Undid import #{}, removed {} records", import_log_id, removed)],
    );

    tx.commit().map_err(|e| e.to_string())?;

    Ok(format!("Undone: {} records removed/deactivated", removed))
}

// ── Import Logs ──────────────────────────────────────

#[tauri::command]
pub fn list_import_logs(state: State<'_, DbState>, limit: Option<i64>) -> Result<Vec<ImportLog>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(10);

    let mut stmt = db.prepare(
        "SELECT id, import_type, filename, rows_added, rows_skipped, rows_errored, error_details, imported_at, imported_ids
         FROM import_logs ORDER BY imported_at DESC LIMIT ?1"
    ).map_err(|e| e.to_string())?;

    let rows = stmt.query_map(params![limit], |row| {
        Ok(ImportLog {
            id: row.get(0)?,
            import_type: row.get(1)?,
            filename: row.get(2)?,
            rows_added: row.get(3)?,
            rows_skipped: row.get(4)?,
            rows_errored: row.get(5)?,
            error_details: row.get(6)?,
            imported_at: row.get(7)?,
            imported_ids: row.get(8)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
