use crate::db::connection::DbState;
use crate::models::import_export::*;
use rusqlite::params;
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
