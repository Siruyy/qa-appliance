use tauri::State;

use crate::db::connection::DbState;
use crate::models::sale::*;

/// List sales with optional search and date range filtering
#[tauri::command]
pub fn get_sales(
    db: State<DbState>,
    search: Option<String>,
    payment_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    include_voided: Option<bool>,
) -> Result<Vec<Sale>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut conditions = Vec::new();
    let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if include_voided != Some(true) {
        conditions.push("s.status = 'completed'".to_string());
    }

    if let Some(ref q) = search {
        conditions.push("(c.name LIKE ?1 OR CAST(s.id AS TEXT) LIKE ?1)".to_string());
        params.push(Box::new(format!("%{}%", q)));
    }

    if let Some(ref pt) = payment_type {
        let idx = params.len() + 1;
        conditions.push(format!("s.payment_type = ?{}", idx));
        params.push(Box::new(pt.clone()));
    }

    if let Some(ref from) = date_from {
        let idx = params.len() + 1;
        conditions.push(format!("s.sale_date >= ?{}", idx));
        params.push(Box::new(from.clone()));
    }

    if let Some(ref to) = date_to {
        let idx = params.len() + 1;
        conditions.push(format!("s.sale_date <= ?{}", idx));
        params.push(Box::new(to.clone()));
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    let sql = format!(
        "SELECT s.id, s.customer_id, s.sale_date, s.subtotal, s.discount, s.total,
                s.payment_type, s.status, s.notes, s.created_at,
                c.name as customer_name
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         {} ORDER BY s.sale_date DESC, s.id DESC",
        where_clause
    );

    let param_refs: Vec<&dyn rusqlite::types::ToSql> = params.iter().map(|p| p.as_ref()).collect();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Sale {
                id: row.get(0)?,
                customer_id: row.get(1)?,
                sale_date: row.get(2)?,
                subtotal: row.get(3)?,
                discount: row.get(4)?,
                total: row.get(5)?,
                payment_type: row.get(6)?,
                status: row.get(7)?,
                notes: row.get(8)?,
                created_at: row.get(9)?,
                customer_name: row.get(10)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let sales: Vec<Sale> = rows.filter_map(|r| r.ok()).collect();
    Ok(sales)
}

/// Get full sale details with items and optional installment account
#[tauri::command]
pub fn get_sale_by_id(db: State<DbState>, id: i64) -> Result<SaleDetail, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get sale
    let sale = conn
        .query_row(
            "SELECT s.id, s.customer_id, s.sale_date, s.subtotal, s.discount, s.total,
                    s.payment_type, s.status, s.notes, s.created_at,
                    c.name as customer_name
             FROM sales s
             LEFT JOIN customers c ON s.customer_id = c.id
             WHERE s.id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Sale {
                    id: row.get(0)?,
                    customer_id: row.get(1)?,
                    sale_date: row.get(2)?,
                    subtotal: row.get(3)?,
                    discount: row.get(4)?,
                    total: row.get(5)?,
                    payment_type: row.get(6)?,
                    status: row.get(7)?,
                    notes: row.get(8)?,
                    created_at: row.get(9)?,
                    customer_name: row.get(10)?,
                })
            },
        )
        .map_err(|e| format!("Sale not found: {}", e))?;

    // Get items with product info
    let mut items_stmt = conn
        .prepare(
            "SELECT si.id, si.sale_id, si.variant_id, si.quantity, si.unit_price, si.subtotal,
                    si.cost_price_snapshot, si.created_at, p.name as product_name, pv.label as variant_label
             FROM sale_items si
             LEFT JOIN product_variants pv ON si.variant_id = pv.id
             LEFT JOIN products p ON pv.product_id = p.id
             WHERE si.sale_id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let items: Vec<SaleItem> = items_stmt
        .query_map(rusqlite::params![id], |row| {
            Ok(SaleItem {
                id: row.get(0)?,
                sale_id: row.get(1)?,
                variant_id: row.get(2)?,
                quantity: row.get(3)?,
                unit_price: row.get(4)?,
                subtotal: row.get(5)?,
                cost_price_snapshot: row.get(6)?,
                created_at: row.get(7)?,
                product_name: row.get(8)?,
                variant_label: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    // Get installment account if exists
    let account = conn
        .query_row(
            "SELECT id, principal, down_payment, interest_rate, balance_remaining,
                    term_months, monthly_amount, status
             FROM installment_accounts WHERE sale_id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(InstallmentAccountSummary {
                    id: row.get(0)?,
                    principal: row.get(1)?,
                    down_payment: row.get(2)?,
                    interest_rate: row.get(3)?,
                    balance_remaining: row.get(4)?,
                    term_months: row.get(5)?,
                    monthly_amount: row.get(6)?,
                    status: row.get(7)?,
                })
            },
        )
        .ok();

    Ok(SaleDetail {
        sale,
        items,
        account,
    })
}

/// Create a new sale (atomic transaction).
/// For installment: creates sale → sale_items → deducts stock → installment_account → payment_schedules
#[tauri::command]
pub fn create_sale(db: State<DbState>, payload: CreateSalePayload) -> Result<i64, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate items
    if payload.items.is_empty() {
        return Err("At least one item is required".to_string());
    }

    if payload.payment_type == "installment" && payload.customer_id.is_none() {
        return Err("Customer is required for installment sales".to_string());
    }

    // Calculate totals
    let subtotal: f64 = payload.items.iter().map(|i| i.unit_price * i.quantity as f64).sum();
    let total = subtotal - payload.discount;

    if total <= 0.0 {
        return Err("Sale total must be positive".to_string());
    }

    // Begin transaction
    conn.execute("BEGIN TRANSACTION", rusqlite::params![]).map_err(|e| e.to_string())?;

    let result = (|| -> Result<i64, String> {
        // 1. Insert sale
        conn.execute(
            "INSERT INTO sales (customer_id, subtotal, discount, total, payment_type, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            rusqlite::params![
                payload.customer_id,
                subtotal,
                payload.discount,
                total,
                payload.payment_type,
                payload.notes,
            ],
        )
        .map_err(|e| e.to_string())?;

        let sale_id = conn.last_insert_rowid();

        // 2. Insert sale items and deduct stock
        for item in &payload.items {
            let item_subtotal = item.unit_price * item.quantity as f64;

            // Snapshot the current cost_price so P&L is historically accurate
            let cost_price_snapshot: f64 = conn.query_row(
                "SELECT cost_price FROM product_variants WHERE id = ?1",
                rusqlite::params![item.variant_id],
                |row| row.get(0),
            ).unwrap_or(0.0);

            conn.execute(
                "INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal, cost_price_snapshot)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![sale_id, item.variant_id, item.quantity, item.unit_price, item_subtotal, cost_price_snapshot],
            )
            .map_err(|e| e.to_string())?;

            // Deduct stock
            let updated = conn.execute(
                "UPDATE product_variants SET stock_qty = stock_qty - ?1
                 WHERE id = ?2 AND stock_qty >= ?1",
                rusqlite::params![item.quantity, item.variant_id],
            )
            .map_err(|e| e.to_string())?;

            if updated == 0 {
                return Err(format!("Insufficient stock for variant {}", item.variant_id));
            }
        }

        // 3. Handle installment account
        if payload.payment_type == "installment" {
            let inst = payload.installment.ok_or("Installment details required")?;
            let principal = total - inst.down_payment;

            if principal < 0.0 {
                return Err("Down payment exceeds sale total".to_string());
            }

            // Calculate monthly amount if schedule exists
            let monthly_amount = if inst.has_schedule {
                let term = inst.term_months.ok_or("Term months required for scheduled installment")?;
                let term_years = term as f64 / 12.0;
                let total_interest = principal * (inst.interest_rate / 100.0) * term_years;
                let total_payable = principal + total_interest;
                Some((total_payable / term as f64 * 100.0).ceil() / 100.0)
            } else {
                None
            };

            let balance = if inst.has_schedule {
                let term = inst.term_months.unwrap();
                monthly_amount.unwrap() * term as f64
            } else {
                principal
            };

            conn.execute(
                "INSERT INTO installment_accounts
                 (sale_id, customer_id, principal, down_payment, interest_rate, penalty_rate,
                  balance_remaining, has_schedule, term_months, monthly_amount, start_date)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                rusqlite::params![
                    sale_id,
                    payload.customer_id,
                    principal,
                    inst.down_payment,
                    inst.interest_rate,
                    inst.penalty_rate,
                    balance,
                    inst.has_schedule as i64,
                    inst.term_months,
                    monthly_amount,
                    inst.start_date,
                ],
            )
            .map_err(|e| e.to_string())?;

            let account_id = conn.last_insert_rowid();

            // Record down payment if > 0
            if inst.down_payment > 0.0 {
                conn.execute(
                    "INSERT INTO payments (account_id, amount, type, notes)
                     VALUES (?1, ?2, 'down_payment', 'Initial down payment')",
                    rusqlite::params![account_id, inst.down_payment],
                )
                .map_err(|e| e.to_string())?;
            }

            // Generate payment schedule
            if inst.has_schedule {
                let term = inst.term_months.unwrap();
                let start = inst.start_date.as_deref().unwrap_or("");
                let monthly = monthly_amount.unwrap();

                for i in 0..term {
                    // Calculate due date by adding months
                    let due_date = add_months_to_date(start, (i + 1) as u32)
                        .map_err(|e| format!("Date calc error: {}", e))?;

                    // Last payment absorbs rounding
                    let amount = if i == term - 1 {
                        balance - monthly * (term - 1) as f64
                    } else {
                        monthly
                    };

                    conn.execute(
                        "INSERT INTO payment_schedules (account_id, due_date, amount_due)
                         VALUES (?1, ?2, ?3)",
                        rusqlite::params![account_id, due_date, amount],
                    )
                    .map_err(|e| e.to_string())?;
                }
            }
        }

        Ok(sale_id)
    })();

    match result {
        Ok(sale_id) => {
            conn.execute("COMMIT", rusqlite::params![]).map_err(|e| e.to_string())?;
            Ok(sale_id)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", rusqlite::params![]);
            Err(e)
        }
    }
}

/// Void a sale (soft delete, restores stock)
#[tauri::command]
pub fn void_sale(db: State<DbState>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Check current status
    let status: String = conn
        .query_row("SELECT status FROM sales WHERE id = ?1", rusqlite::params![id], |row| {
            row.get(0)
        })
        .map_err(|_| "Sale not found".to_string())?;

    if status == "voided" {
        return Err("Sale is already voided".to_string());
    }

    // Check for installment accounts with payments
    let has_payments: bool = conn
        .query_row(
            "SELECT EXISTS(
                SELECT 1 FROM payments p
                JOIN installment_accounts a ON p.account_id = a.id
                WHERE a.sale_id = ?1 AND p.type != 'down_payment'
            )",
            rusqlite::params![id],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if has_payments {
        return Err("Cannot void sale with existing payments. Manage via accounts receivable.".to_string());
    }

    conn.execute("BEGIN TRANSACTION", rusqlite::params![]).map_err(|e| e.to_string())?;

    let result = (|| -> Result<(), String> {
        // Restore stock for all items
        conn.execute(
            "UPDATE product_variants SET stock_qty = stock_qty + (
                SELECT si.quantity FROM sale_items si WHERE si.variant_id = product_variants.id AND si.sale_id = ?1
             ) WHERE id IN (SELECT variant_id FROM sale_items WHERE sale_id = ?1)",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

        // Delete installment data (schedule + account)
        conn.execute(
            "DELETE FROM payment_schedules WHERE account_id IN
             (SELECT id FROM installment_accounts WHERE sale_id = ?1)",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM payments WHERE account_id IN
             (SELECT id FROM installment_accounts WHERE sale_id = ?1)",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

        conn.execute(
            "DELETE FROM installment_accounts WHERE sale_id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

        // Mark sale as voided
        conn.execute(
            "UPDATE sales SET status = 'voided' WHERE id = ?1",
            rusqlite::params![id],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    })();

    match result {
        Ok(()) => {
            conn.execute("COMMIT", rusqlite::params![]).map_err(|e| e.to_string())?;
            Ok(())
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", rusqlite::params![]);
            Err(e)
        }
    }
}

/// Add months to a date string (YYYY-MM-DD)
fn add_months_to_date(date_str: &str, months: u32) -> Result<String, String> {
    let parts: Vec<&str> = date_str.split('-').collect();
    if parts.len() != 3 {
        return Err("Invalid date format".to_string());
    }

    let year: i32 = parts[0].parse().map_err(|_| "Invalid year")?;
    let month: u32 = parts[1].parse().map_err(|_| "Invalid month")?;
    let day: u32 = parts[2].parse().map_err(|_| "Invalid day")?;

    let total_months = (year * 12 + month as i32 - 1) + months as i32;
    let new_year = total_months / 12;
    let new_month = (total_months % 12) + 1;

    // Clamp day to last day of target month
    let days_in_month = match new_month as u32 {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 => {
            if (new_year % 4 == 0 && new_year % 100 != 0) || (new_year % 400 == 0) {
                29
            } else {
                28
            }
        }
        _ => 30,
    };

    let clamped_day = day.min(days_in_month);
    Ok(format!("{:04}-{:02}-{:02}", new_year, new_month, clamped_day))
}
