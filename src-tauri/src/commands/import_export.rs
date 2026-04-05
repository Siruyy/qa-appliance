use crate::db::connection::DbState;
use crate::models::import_export::*;
use calamine::{open_workbook, Reader, Xlsx};
use rusqlite::params;
use std::collections::HashMap;
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

// ── Export Commands ───────────────────────────────────

#[tauri::command]
pub fn export_products_data(state: State<'_, DbState>) -> Result<Vec<ExportProduct>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

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

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn export_customers_data(state: State<'_, DbState>) -> Result<Vec<ExportCustomer>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

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

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn export_sales_data(state: State<'_, DbState>) -> Result<Vec<ExportSale>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT s.id, s.sale_date,
                COALESCE(cu.name, 'Walk-in') AS customer_name,
                GROUP_CONCAT(p.name || ' - ' || COALESCE(pv.sku, 'N/A'), ', ') AS items_summary,
                s.total, s.payment_type,
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
            payment_type: row.get(5)?,
            down_payment: row.get(6)?,
            status: row.get(7)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn export_accounts_data(state: State<'_, DbState>) -> Result<Vec<ExportAccount>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = db.prepare(
        "SELECT ia.id, cu.name AS customer_name,
                GROUP_CONCAT(p.name || ' - ' || COALESCE(pv.sku, 'N/A'), ', ') AS product_summary,
                ia.principal, ia.balance_remaining, ia.interest_rate, ia.penalty_rate,
                ia.term_months, ia.has_schedule, ia.status, ia.created_at
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
        let has_schedule_int: i64 = row.get(8)?;
        Ok(ExportAccount {
            id: row.get(0)?,
            customer_name: row.get(1)?,
            product_summary: row.get::<_, Option<String>>(2)?.unwrap_or_default(),
            principal: row.get(3)?,
            balance_remaining: row.get(4)?,
            interest_rate: row.get(5)?,
            penalty_rate: row.get(6)?,
            term_months: row.get(7)?,
            has_schedule: has_schedule_int != 0,
            status: row.get(9)?,
            created_at: row.get(10)?,
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn export_payments_data(
    state: State<'_, DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
) -> Result<Vec<ExportPayment>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

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

    if let Some(ref fd) = from_date {
        sql.push_str(" AND py.payment_date >= ?");
        params.push(Box::new(fd.clone()));
    }
    if let Some(ref td) = to_date {
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

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}

#[tauri::command]
pub fn export_all_data(state: State<'_, DbState>) -> Result<ExportAllData, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;

    // Categories
    let categories = {
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
        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        result
    };

    // We need to drop the lock and re-acquire to call the other functions
    // Instead, query everything inline
    drop(db);

    let products = export_products_data(state.clone())?;
    let customers = export_customers_data(state.clone())?;
    let sales = export_sales_data(state.clone())?;
    let accounts = export_accounts_data(state.clone())?;
    let payments = export_payments_data(state.clone(), None, None)?;

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
    let (headers, data_rows) = read_excel_rows(&file_path)?;

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
        let name = get_field(&data, "name");

        if name.is_empty() {
            errors.push(ImportErrorRow {
                row_number,
                data,
                errors: vec!["name is required".to_string()],
            });
            continue;
        }

        // Check for duplicate
        let phone = get_field(&data, "phone");
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

    let db = state.0.lock().map_err(|e| e.to_string())?;
    let mut added: i64 = 0;
    let skipped = preview.skip_rows.len() as i64;
    let errored = preview.error_rows.len() as i64;

    match import_type.as_str() {
        "products" => {
            for row in &preview.valid_rows {
                if let Err(e) = import_product_row(&db, &row.data) {
                    eprintln!("[import] product row {} failed: {}", row.row_number, e);
                    continue;
                }
                added += 1;
            }
        }
        "customers" => {
            for row in &preview.valid_rows {
                if let Err(e) = import_customer_row(&db, &row.data) {
                    eprintln!("[import] customer row {} failed: {}", row.row_number, e);
                    continue;
                }
                added += 1;
            }
        }
        "balances" => {
            for row in &preview.valid_rows {
                if let Err(e) = import_balance_row(&db, &row.data) {
                    eprintln!("[import] balance row {} failed: {}", row.row_number, e);
                    continue;
                }
                added += 1;
            }
        }
        _ => return Err(format!("Unknown import type: {}", import_type)),
    }

    // Record in import_logs
    let filename = file_path.rsplit('/').next().unwrap_or(&file_path).to_string();
    let error_details = if !preview.error_rows.is_empty() {
        let details: Vec<serde_json::Value> = preview.error_rows.iter().map(|e| {
            serde_json::json!({ "row": e.row_number, "message": e.errors.join("; ") })
        }).collect();
        Some(serde_json::to_string(&details).unwrap_or_default())
    } else {
        None
    };

    db.execute(
        "INSERT INTO import_logs (import_type, filename, rows_added, rows_skipped, rows_errored, error_details)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![import_type, filename, added, skipped, errored, error_details],
    ).map_err(|e| e.to_string())?;

    Ok(ImportResult { rows_added: added, rows_skipped: skipped, rows_errored: errored })
}

fn import_product_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<(), String> {
    let category_name = get_field(data, "category");
    let product_name = get_field(data, "product_name");
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

    // Find or create product
    let product_id: i64 = match db.query_row(
        "SELECT id FROM products WHERE category_id = ?1 AND name = ?2",
        params![category_id, product_name],
        |row| row.get(0),
    ) {
        Ok(id) => id,
        Err(_) => {
            db.execute(
                "INSERT INTO products (category_id, name) VALUES (?1, ?2)",
                params![category_id, product_name],
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
    let attrs_json = if attrs.is_empty() { None } else { Some(serde_json::to_string(&attrs).unwrap()) };

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
    } else {
        // Insert new
        let sku_val = if sku.is_empty() { None } else { Some(sku) };
        db.execute(
            "INSERT INTO product_variants (product_id, sku, attributes, cost_price, selling_price, stock_qty, low_stock_threshold)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![product_id, sku_val, attrs_json, cost_price, selling_price, stock_qty, threshold],
        ).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn import_customer_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<(), String> {
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

    Ok(())
}

fn import_balance_row(db: &rusqlite::Connection, data: &HashMap<String, String>) -> Result<(), String> {
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
                chrono_free_today()
            });
            for month_idx in 1..=term {
                let due_date = add_months_to_date(&base_date, month_idx as u32);
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

    Ok(())
}

// Simple date helpers (no chrono dependency)
fn chrono_free_today() -> String {
    // Use system time to get today's date
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let days = (now / 86400) as i64;
    let (y, m, d) = civil_from_days(days + 719468);
    format!("{:04}-{:02}-{:02}", y, m, d)
}

fn add_months_to_date(date_str: &str, months: u32) -> String {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 { return date_str.to_string(); }
    let y: i32 = parts[0].parse().unwrap_or(2026);
    let m: u32 = parts[1].parse().unwrap_or(1);
    let d: u32 = parts[2].parse().unwrap_or(1);

    let total_months = (y as u32) * 12 + (m - 1) + months;
    let new_y = (total_months / 12) as i32;
    let new_m = (total_months % 12) + 1;
    let max_d = days_in_month(new_y, new_m);
    let new_d = d.min(max_d);
    format!("{:04}-{:02}-{:02}", new_y, new_m, new_d)
}

fn days_in_month(y: i32, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => if y % 4 == 0 && (y % 100 != 0 || y % 400 == 0) { 29 } else { 28 },
        _ => 30,
    }
}

fn civil_from_days(days: i64) -> (i32, u32, u32) {
    let era = if days >= 0 { days } else { days - 146096 } / 146097;
    let doe = (days - era * 146097) as u32;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe as i64 + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y as i32, m, d)
}

// ── Import Logs ──────────────────────────────────────

#[tauri::command]
pub fn list_import_logs(state: State<'_, DbState>, limit: Option<i64>) -> Result<Vec<ImportLog>, String> {
    let db = state.0.lock().map_err(|e| e.to_string())?;
    let limit = limit.unwrap_or(10);

    let mut stmt = db.prepare(
        "SELECT id, import_type, filename, rows_added, rows_skipped, rows_errored, error_details, imported_at
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
        })
    }).map_err(|e| e.to_string())?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row.map_err(|e| e.to_string())?);
    }
    Ok(result)
}
