use rusqlite::params;
use tauri::State;

use crate::db::connection::DbState;
use crate::models::customer::*;
use crate::models::PaginatedResult;
use crate::utils::validation::{require_text, optional_text, optional_phone};

// ────────────────────────────────────────────
// Get Customers (list with computed fields)
// ────────────────────────────────────────────

#[tauri::command]
pub fn get_customers(
    db: State<'_, DbState>,
    include_archived: bool,
    search: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PaginatedResult<Customer>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Build WHERE conditions
    let mut where_parts: Vec<String> = vec!["1=1".to_string()];
    let search_val = search.as_deref().map(|s| s.trim().to_string()).filter(|s| !s.is_empty());

    if !include_archived {
        where_parts.push("c.is_active = 1".to_string());
    }
    if search_val.is_some() {
        where_parts.push("(c.name LIKE ?1 OR c.phone LIKE ?1)".to_string());
    }
    let where_clause = where_parts.join(" AND ");

    // COUNT query
    let count_sql = format!(
        "SELECT COUNT(*) FROM customers c WHERE {}",
        where_clause
    );
    let total: u64 = if let Some(ref q) = search_val {
        let like_val = format!("%{}%", q);
        conn.query_row(&count_sql, rusqlite::params![like_val], |row| row.get(0))
            .unwrap_or(0)
    } else {
        conn.query_row(&count_sql, [], |row| row.get(0))
            .unwrap_or(0)
    };

    // Build pagination clause
    let pagination = match limit {
        Some(l) => format!("LIMIT {} OFFSET {}", l, offset.unwrap_or(0)),
        None => String::new(),
    };

    // Data query
    let sql = format!(
        "SELECT c.id, c.name, c.phone, c.address, c.notes, c.is_active,
                COALESCE(acc.open_count, 0) AS open_accounts_count,
                COALESCE(acc.total_bal, 0.0) AS total_balance,
                c.created_at, c.updated_at
         FROM customers c
         LEFT JOIN (
           SELECT customer_id,
                  COUNT(*) AS open_count,
                  SUM(balance_remaining) AS total_bal
           FROM installment_accounts
           WHERE status = 'open'
           GROUP BY customer_id
         ) acc ON acc.customer_id = c.id
         WHERE {}
         ORDER BY c.name {}",
        where_clause, pagination
    );

    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    if let Some(ref q) = search_val {
        param_values.push(Box::new(format!("%{}%", q)));
    }

    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(params_ref.as_slice(), |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                notes: row.get(4)?,
                is_active: row.get(5)?,
                open_accounts_count: row.get(6)?,
                total_balance: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let customers: Vec<Customer> = rows
        .filter_map(|r| r.ok())
        .collect();

    Ok(PaginatedResult { items: customers, total })
}

// ────────────────────────────────────────────
// Get Customer by ID (detail view)
// ────────────────────────────────────────────

#[tauri::command]
pub fn get_customer_by_id(
    db: State<'_, DbState>,
    id: i64,
) -> Result<CustomerDetail, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Customer + computed fields
    let customer = conn
        .query_row(
            "SELECT c.id, c.name, c.phone, c.address, c.notes, c.is_active,
                    COALESCE(acc.open_count, 0), COALESCE(acc.total_bal, 0.0),
                    c.created_at, c.updated_at
             FROM customers c
             LEFT JOIN (
               SELECT customer_id,
                      COUNT(*) AS open_count,
                      SUM(balance_remaining) AS total_bal
               FROM installment_accounts
               WHERE status = 'open'
               GROUP BY customer_id
             ) acc ON acc.customer_id = c.id
             WHERE c.id = ?1",
            params![id],
            |row| {
                Ok(Customer {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    phone: row.get(2)?,
                    address: row.get(3)?,
                    notes: row.get(4)?,
                    is_active: row.get(5)?,
                    open_accounts_count: row.get(6)?,
                    total_balance: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
        .map_err(|e| format!("Customer not found: {}", e))?;

    // Sales for this customer
    let mut sales_stmt = conn
        .prepare(
            "SELECT s.id, s.sale_date, s.total, s.payment_type, s.status,
                    GROUP_CONCAT(p.name || ' (×' || si.quantity || ')', ', ') AS items_summary
             FROM sales s
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN product_variants pv ON pv.id = si.variant_id
             LEFT JOIN products p ON p.id = pv.product_id
             WHERE s.customer_id = ?1
             GROUP BY s.id
             ORDER BY s.sale_date DESC",
        )
        .map_err(|e| e.to_string())?;

    let sales: Vec<CustomerSaleSummary> = sales_stmt
        .query_map(params![id], |row| {
            Ok(CustomerSaleSummary {
                id: row.get(0)?,
                sale_date: row.get(1)?,
                total: row.get(2)?,
                payment_type: row.get(3)?,
                status: row.get(4)?,
                items_summary: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Installment accounts for this customer
    let mut accts_stmt = conn
        .prepare(
            "SELECT ia.id, ia.sale_id, ia.principal, ia.balance_remaining,
                    ia.has_schedule, ia.term_months, ia.monthly_amount, ia.status,
                    GROUP_CONCAT(p.name || ' (×' || si.quantity || ')', ', ') AS items_summary
             FROM installment_accounts ia
             LEFT JOIN sales s ON s.id = ia.sale_id
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN product_variants pv ON pv.id = si.variant_id
             LEFT JOIN products p ON p.id = pv.product_id
             WHERE ia.customer_id = ?1
             GROUP BY ia.id
             ORDER BY ia.created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let accounts: Vec<CustomerAccountSummary> = accts_stmt
        .query_map(params![id], |row| {
            Ok(CustomerAccountSummary {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                principal: row.get(2)?,
                balance_remaining: row.get(3)?,
                has_schedule: row.get(4)?,
                term_months: row.get(5)?,
                monthly_amount: row.get(6)?,
                status: row.get(7)?,
                items_summary: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    // Payments for this customer's accounts
    let mut pay_stmt = conn
        .prepare(
            "SELECT pay.id, pay.account_id, pay.amount, pay.payment_date,
                    pay.type, pay.notes
             FROM payments pay
             INNER JOIN installment_accounts ia ON ia.id = pay.account_id
             WHERE ia.customer_id = ?1
             ORDER BY pay.payment_date DESC",
        )
        .map_err(|e| e.to_string())?;

    let payments: Vec<CustomerPaymentSummary> = pay_stmt
        .query_map(params![id], |row| {
            Ok(CustomerPaymentSummary {
                id: row.get(0)?,
                account_id: row.get(1)?,
                amount: row.get(2)?,
                payment_date: row.get(3)?,
                r#type: row.get(4)?,
                notes: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    Ok(CustomerDetail {
        customer,
        sales,
        accounts,
        payments,
    })
}

// ────────────────────────────────────────────
// Create Customer
// ────────────────────────────────────────────

#[tauri::command]
pub fn create_customer(
    db: State<'_, DbState>,
    payload: CreateCustomerPayload,
) -> Result<Customer, String> {
    let name = require_text("Name", &payload.name, 200)?;
    let phone = optional_phone(&payload.phone)?;
    let address = optional_text("Address", &payload.address, 500)?;
    let notes = optional_text("Notes", &payload.notes, 2000)?;

    let conn = db.0.lock().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO customers (name, phone, address, notes) VALUES (?1, ?2, ?3, ?4)",
        params![name, phone, address, notes],
    )
    .map_err(|e| e.to_string())?;

    let id = conn.last_insert_rowid();
    conn.query_row(
        "SELECT id, name, phone, address, notes, is_active, 0, 0.0, created_at, updated_at
         FROM customers WHERE id = ?1",
        params![id],
        |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                notes: row.get(4)?,
                is_active: row.get(5)?,
                open_accounts_count: row.get(6)?,
                total_balance: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

// ────────────────────────────────────────────
// Update Customer
// ────────────────────────────────────────────

#[tauri::command]
pub fn update_customer(
    db: State<'_, DbState>,
    payload: UpdateCustomerPayload,
) -> Result<Customer, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut sets: Vec<String> = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
    let mut idx = 1;

    if let Some(ref name) = payload.name {
        let validated = require_text("Name", name, 200)?;
        sets.push(format!("name = ?{}", idx));
        param_values.push(Box::new(validated));
        idx += 1;
    }
    if let Some(ref phone) = payload.phone {
        let validated = optional_phone(&Some(phone.clone()))?;
        sets.push(format!("phone = ?{}", idx));
        param_values.push(Box::new(validated));
        idx += 1;
    }
    if let Some(ref address) = payload.address {
        let validated = optional_text("Address", &Some(address.clone()), 500)?;
        sets.push(format!("address = ?{}", idx));
        param_values.push(Box::new(validated));
        idx += 1;
    }
    if let Some(ref notes) = payload.notes {
        let validated = optional_text("Notes", &Some(notes.clone()), 2000)?;
        sets.push(format!("notes = ?{}", idx));
        param_values.push(Box::new(validated));
        idx += 1;
    }

    if sets.is_empty() {
        return Err("No fields to update".into());
    }

    sets.push(format!("updated_at = datetime('now')"));
    let sql = format!(
        "UPDATE customers SET {} WHERE id = ?{}",
        sets.join(", "),
        idx
    );
    param_values.push(Box::new(payload.id));

    let params_ref: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();
    conn.execute(&sql, params_ref.as_slice())
        .map_err(|e| e.to_string())?;

    // Return updated customer with computed fields
    conn.query_row(
        "SELECT c.id, c.name, c.phone, c.address, c.notes, c.is_active,
                COALESCE(acc.open_count, 0), COALESCE(acc.total_bal, 0.0),
                c.created_at, c.updated_at
         FROM customers c
         LEFT JOIN (
           SELECT customer_id,
                  COUNT(*) AS open_count,
                  SUM(balance_remaining) AS total_bal
           FROM installment_accounts
           WHERE status = 'open'
           GROUP BY customer_id
         ) acc ON acc.customer_id = c.id
         WHERE c.id = ?1",
        params![payload.id],
        |row| {
            Ok(Customer {
                id: row.get(0)?,
                name: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
                notes: row.get(4)?,
                is_active: row.get(5)?,
                open_accounts_count: row.get(6)?,
                total_balance: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

// ────────────────────────────────────────────
// Archive Customer (soft delete)
// ────────────────────────────────────────────

#[tauri::command]
pub fn archive_customer(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check for open accounts
    let open_count: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM installment_accounts WHERE customer_id = ?1 AND status = 'open'",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    if open_count > 0 {
        return Err(format!(
            "Cannot archive customer: {} open account(s) remain",
            open_count
        ));
    }

    conn.execute(
        "UPDATE customers SET is_active = 0, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ────────────────────────────────────────────
// Restore Customer
// ────────────────────────────────────────────

#[tauri::command]
pub fn restore_customer(db: State<'_, DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE customers SET is_active = 1, updated_at = datetime('now') WHERE id = ?1",
        params![id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
