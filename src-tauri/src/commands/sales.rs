use tauri::State;

use crate::db::connection::DbState;
use crate::models::sale::*;
use crate::models::PaginatedResult;
use crate::utils::date::add_months_to_date;
use crate::utils::query::{build_where, paginated_query};
use crate::commands::audit_log::insert_audit;

/// List sales with optional search and date range filtering
#[tauri::command]
pub fn get_sales(
    db: State<DbState>,
    search: Option<String>,
    payment_type: Option<String>,
    date_from: Option<String>,
    date_to: Option<String>,
    include_voided: Option<bool>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PaginatedResult<Sale>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut conditions = Vec::new();
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if include_voided != Some(true) {
        conditions.push("s.status = 'completed'".to_string());
    }

    if let Some(ref q) = search {
        conditions.push("(c.name LIKE ?1 OR CAST(s.id AS TEXT) LIKE ?1)".to_string());
        param_values.push(Box::new(format!("%{}%", q)));
    }
    if let Some(ref pt) = payment_type {
        let idx = param_values.len() + 1;
        conditions.push(format!("s.payment_type = ?{}", idx));
        param_values.push(Box::new(pt.clone()));
    }
    if let Some(ref from) = date_from {
        let idx = param_values.len() + 1;
        conditions.push(format!("s.sale_date >= ?{}", idx));
        param_values.push(Box::new(from.clone()));
    }
    if let Some(ref to) = date_to {
        let idx = param_values.len() + 1;
        conditions.push(format!("s.sale_date <= ?{}", idx));
        param_values.push(Box::new(to.clone()));
    }

    let where_clause = build_where(&conditions);
    let params: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let count_sql = format!(
        "SELECT COUNT(*) FROM sales s LEFT JOIN customers c ON s.customer_id = c.id {}",
        where_clause
    );

    let data_sql = format!(
        "SELECT s.id, s.customer_id, s.sale_date, s.subtotal, s.discount,
                s.discount_type, s.discount_value,
                s.total, s.payment_type, s.status, s.notes, s.created_at,
                c.name as customer_name
         FROM sales s
         LEFT JOIN customers c ON s.customer_id = c.id
         {} ORDER BY s.sale_date DESC, s.id DESC",
        where_clause
    );

    paginated_query(&conn, &count_sql, &data_sql, &params, limit, offset, |row| {
        Ok(Sale {
            id: row.get(0)?,
            customer_id: row.get(1)?,
            sale_date: row.get(2)?,
            subtotal: row.get(3)?,
            discount: row.get(4)?,
            discount_type: row.get(5)?,
            discount_value: row.get(6)?,
            total: row.get(7)?,
            payment_type: row.get(8)?,
            status: row.get(9)?,
            notes: row.get(10)?,
            created_at: row.get(11)?,
            customer_name: row.get(12)?,
        })
    })
}

/// Get full sale details with items and optional installment account
#[tauri::command]
pub fn get_sale_by_id(db: State<DbState>, id: i64) -> Result<SaleDetail, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Get sale
    let sale = conn
        .query_row(
            "SELECT s.id, s.customer_id, s.sale_date, s.subtotal, s.discount,
                    s.discount_type, s.discount_value,
                    s.total, s.payment_type, s.status, s.notes, s.created_at,
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
                    discount_type: row.get(5)?,
                    discount_value: row.get(6)?,
                    total: row.get(7)?,
                    payment_type: row.get(8)?,
                    status: row.get(9)?,
                    notes: row.get(10)?,
                    created_at: row.get(11)?,
                    customer_name: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Sale not found: {}", e))?;

    // Get items with product info
    let mut items_stmt = conn
        .prepare(
            "SELECT si.id, si.sale_id, si.variant_id, si.quantity, si.unit_price, si.subtotal,
                    si.cost_price_snapshot, si.item_discount, si.item_discount_type, si.item_discount_value,
                    si.created_at, p.name as product_name, pv.attributes as variant_label
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
                item_discount: row.get(7)?,
                item_discount_type: row.get(8)?,
                item_discount_value: row.get(9)?,
                created_at: row.get(10)?,
                product_name: row.get(11)?,
                variant_label: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row read error: {}", e))?;

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
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate items
    if payload.items.is_empty() {
        return Err("At least one item is required".to_string());
    }

    if payload.payment_type == "installment" && payload.customer_id.is_none() {
        return Err("Customer is required for installment sales".to_string());
    }

    // Calculate per-item discounts and subtotal
    let mut subtotal = 0.0_f64;
    for item in &payload.items {
        let line_total = item.unit_price * item.quantity as f64;
        let item_disc = match item.item_discount_type.as_str() {
            "percent" => (line_total * item.item_discount_value / 100.0 * 100.0).round() / 100.0,
            _ => item.item_discount_value,
        };
        subtotal += line_total - item_disc;
    }

    // Resolve sale-level discount
    let discount_type = payload.discount_type.as_str();
    let discount_value = if payload.discount_value > 0.0 { payload.discount_value } else { payload.discount };
    let resolved_discount = match discount_type {
        "percent" => (subtotal * discount_value / 100.0 * 100.0).round() / 100.0,
        _ => discount_value,
    };
    let total = subtotal - resolved_discount;

    // Validate unit prices match DB selling_price (prevent client manipulation)
    for item in &payload.items {
        let db_price: f64 = conn.query_row(
            "SELECT selling_price FROM product_variants WHERE id = ?1 AND is_active = 1",
            rusqlite::params![item.variant_id],
            |row| row.get(0),
        ).map_err(|_| format!("Product variant {} not found or inactive", item.variant_id))?;

        if (item.unit_price - db_price).abs() > 0.01 {
            return Err(format!(
                "Price mismatch for variant {}: sent {:.2}, expected {:.2}",
                item.variant_id, item.unit_price, db_price
            ));
        }
    }

    if total <= 0.0 {
        return Err("Sale total must be positive".to_string());
    }

    // Use rusqlite Transaction API for automatic rollback on error
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Insert sale
    tx.execute(
        "INSERT INTO sales (customer_id, subtotal, discount, discount_type, discount_value, total, payment_type, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
        rusqlite::params![
            payload.customer_id,
            subtotal,
            resolved_discount,
            discount_type,
            discount_value,
            total,
            payload.payment_type,
            payload.notes,
        ],
    )
    .map_err(|e| e.to_string())?;

    let sale_id = tx.last_insert_rowid();

    // 2. Insert sale items and deduct stock
    for item in &payload.items {
        let line_total = item.unit_price * item.quantity as f64;
        let item_disc_type = item.item_discount_type.as_str();
        let item_disc_value = item.item_discount_value;
        let item_disc = match item_disc_type {
            "percent" => (line_total * item_disc_value / 100.0 * 100.0).round() / 100.0,
            _ => item_disc_value,
        };
        let item_subtotal = line_total - item_disc;

        // Snapshot the current cost_price so P&L is historically accurate
        let cost_price_snapshot: f64 = tx.query_row(
            "SELECT cost_price FROM product_variants WHERE id = ?1",
            rusqlite::params![item.variant_id],
            |row| row.get(0),
        ).unwrap_or(0.0);

        tx.execute(
            "INSERT INTO sale_items (sale_id, variant_id, quantity, unit_price, subtotal, cost_price_snapshot,
             item_discount, item_discount_type, item_discount_value)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            rusqlite::params![sale_id, item.variant_id, item.quantity, item.unit_price, item_subtotal, cost_price_snapshot,
                item_disc, item_disc_type, item_disc_value],
        )
        .map_err(|e| e.to_string())?;

        // Deduct stock
        let updated = tx.execute(
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

        if let Some(ref start) = inst.start_date {
            crate::utils::validation::require_iso_date("start_date", start)?;
        }

        // All installments have schedules — calculate monthly amount
        // Filipino add-on (flat) interest: total_interest = principal × monthly_rate × term_months
        // interest_rate is stored as a monthly percentage (e.g. 5 = 5%/month)
        let term = inst.term_months.ok_or("Term months required for installment")?;
        let monthly_rate = inst.interest_rate / 100.0;
        let total_interest = principal * monthly_rate * term as f64;
        let total_payable = principal + total_interest;
        let monthly_amount = (total_payable / term as f64 * 100.0).ceil() / 100.0;
        let balance = total_payable - inst.down_payment;

        tx.execute(
            "INSERT INTO installment_accounts
             (sale_id, customer_id, principal, down_payment, interest_rate, penalty_rate,
              balance_remaining, has_schedule, term_months, monthly_amount, start_date, rebate_rate)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
            rusqlite::params![
                sale_id,
                payload.customer_id,
                principal,
                inst.down_payment,
                inst.interest_rate,
                inst.penalty_rate,
                balance,
                1_i64, // has_schedule always true
                inst.term_months,
                Some(monthly_amount),
                inst.start_date,
                inst.rebate_rate,
            ],
        )
        .map_err(|e| e.to_string())?;

        let account_id = tx.last_insert_rowid();

        // Record down payment if > 0
        if inst.down_payment > 0.0 {
            tx.execute(
                "INSERT INTO payments (account_id, amount, type, notes)
                 VALUES (?1, ?2, 'down_payment', 'Initial down payment')",
                rusqlite::params![account_id, inst.down_payment],
            )
            .map_err(|e| e.to_string())?;
        }

        // Generate payment schedule (always)
        {
            let start = inst.start_date.as_deref().unwrap_or("");
            let monthly = monthly_amount;

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

                tx.execute(
                    "INSERT INTO payment_schedules (account_id, due_date, amount_due)
                     VALUES (?1, ?2, ?3)",
                    rusqlite::params![account_id, due_date, amount],
                )
                .map_err(|e| e.to_string())?;
            }
        }
    }

    let _ = insert_audit(&tx, "sale_created", "sale", Some(sale_id), Some(&format!("{} sale, {} items", payload.payment_type, payload.items.len())));
    tx.commit().map_err(|e| e.to_string())?;
    Ok(sale_id)
}

/// Void a sale (soft delete, restores stock)
#[tauri::command]
pub fn void_sale(db: State<DbState>, id: i64) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

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
        return Err("Cannot void sale with recorded payments. Reverse payments first.".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // Restore stock for all items — use SUM to handle multiple items for the same variant
    tx.execute(
        "UPDATE product_variants SET stock_qty = stock_qty + (
            SELECT COALESCE(SUM(si.quantity), 0) FROM sale_items si
            WHERE si.variant_id = product_variants.id AND si.sale_id = ?1
         ) WHERE id IN (SELECT variant_id FROM sale_items WHERE sale_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    // Soft-delete installment data — set status to 'voided' instead of hard DELETE
    tx.execute(
        "UPDATE payment_schedules SET status = 'voided'
         WHERE account_id IN (SELECT id FROM installment_accounts WHERE sale_id = ?1)",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    tx.execute(
        "UPDATE installment_accounts SET status = 'voided', updated_at = datetime('now')
         WHERE sale_id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    // Mark sale as voided
    tx.execute(
        "UPDATE sales SET status = 'voided' WHERE id = ?1",
        rusqlite::params![id],
    )
    .map_err(|e| e.to_string())?;

    let _ = insert_audit(&tx, "sale_voided", "sale", Some(id), None);
    tx.commit().map_err(|e| e.to_string())?;
    Ok(())
}
