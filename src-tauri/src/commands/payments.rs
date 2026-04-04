use tauri::State;

use crate::db::connection::DbState;
use crate::models::payment::{Payment, RecordPaymentPayload};
use crate::models::PaginatedResult;

#[tauri::command]
pub fn get_payments(
    db: State<DbState>,
    from_date: Option<String>,
    to_date: Option<String>,
    customer_id: Option<i64>,
    search: Option<String>,
    limit: Option<u32>,
    offset: Option<u32>,
) -> Result<PaginatedResult<Payment>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut conditions: Vec<String> = Vec::new();

    if let Some(ref from) = from_date {
        if !from.is_empty() {
            conditions.push(format!("pay.payment_date >= ?{}", conditions.len() + 1));
        }
    }
    if let Some(ref to) = to_date {
        if !to.is_empty() {
            conditions.push(format!("pay.payment_date <= ?{}", conditions.len() + 1));
        }
    }
    if customer_id.is_some() {
        conditions.push(format!("ia.customer_id = ?{}", conditions.len() + 1));
    }
    if let Some(ref s) = search {
        if !s.is_empty() {
            conditions.push(format!("c.name LIKE ?{}", conditions.len() + 1));
        }
    }

    let where_clause = if conditions.is_empty() {
        String::new()
    } else {
        format!("WHERE {}", conditions.join(" AND "))
    };

    // Build params in insertion order for reuse
    let make_params = || -> Vec<Box<dyn rusqlite::types::ToSql>> {
        let mut p: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();
        if let Some(ref from) = from_date {
            if !from.is_empty() { p.push(Box::new(from.clone())); }
        }
        if let Some(ref to) = to_date {
            if !to.is_empty() { p.push(Box::new(format!("{}T23:59:59", to))); }
        }
        if let Some(cid) = customer_id {
            p.push(Box::new(cid));
        }
        if let Some(ref s) = search {
            if !s.is_empty() { p.push(Box::new(format!("%{}%", s))); }
        }
        p
    };

    // COUNT query
    let count_sql = format!(
        "SELECT COUNT(DISTINCT pay.id)
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         JOIN customers c ON c.id = ia.customer_id
         {}",
        where_clause
    );
    let count_p = make_params();
    let count_refs: Vec<&dyn rusqlite::types::ToSql> = count_p.iter().map(|p| p.as_ref()).collect();
    let total: u64 = conn
        .query_row(&count_sql, count_refs.as_slice(), |row| row.get(0))
        .unwrap_or(0);

    let pagination = match limit {
        Some(l) => format!("LIMIT {} OFFSET {}", l, offset.unwrap_or(0)),
        None => String::new(),
    };

    let sql = format!(
        "SELECT pay.id, pay.account_id, pay.schedule_id, c.name AS customer_name,
                COALESCE(
                    GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, ''), ', '),
                    'Unknown Product'
                ) AS product_summary,
                pay.amount, pay.payment_date, pay.type, pay.notes, pay.created_at
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         JOIN customers c ON c.id = ia.customer_id
         JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants v ON v.id = si.variant_id
         LEFT JOIN products p ON p.id = v.product_id
         {}
         GROUP BY pay.id
         ORDER BY pay.payment_date DESC, pay.id DESC {}",
        where_clause, pagination
    );

    let data_p = make_params();
    let mut stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
    let param_refs: Vec<&dyn rusqlite::types::ToSql> = data_p.iter().map(|p| p.as_ref()).collect();

    let rows = stmt
        .query_map(param_refs.as_slice(), |row| {
            Ok(Payment {
                id: row.get(0)?,
                account_id: row.get(1)?,
                schedule_id: row.get(2)?,
                customer_name: row.get(3)?,
                product_summary: row.get(4)?,
                amount: row.get(5)?,
                payment_date: row.get(6)?,
                payment_type: row.get(7)?,
                notes: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let payments: Vec<Payment> = rows.filter_map(|r| r.ok()).collect();
    Ok(PaginatedResult { items: payments, total })
}

#[tauri::command]
pub fn get_payments_for_account(
    db: State<DbState>,
    account_id: i64,
) -> Result<Vec<Payment>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            "SELECT pay.id, pay.account_id, pay.schedule_id, c.name AS customer_name,
                    COALESCE(
                        GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, ''), ', '),
                        'Unknown Product'
                    ) AS product_summary,
                    pay.amount, pay.payment_date, pay.type, pay.notes, pay.created_at
             FROM payments pay
             JOIN installment_accounts ia ON ia.id = pay.account_id
             JOIN customers c ON c.id = ia.customer_id
             JOIN sales s ON s.id = ia.sale_id
             LEFT JOIN sale_items si ON si.sale_id = s.id
             LEFT JOIN product_variants v ON v.id = si.variant_id
             LEFT JOIN products p ON p.id = v.product_id
             WHERE pay.account_id = ?1
             GROUP BY pay.id
             ORDER BY pay.payment_date DESC, pay.id DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(rusqlite::params![account_id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                account_id: row.get(1)?,
                schedule_id: row.get(2)?,
                customer_name: row.get(3)?,
                product_summary: row.get(4)?,
                amount: row.get(5)?,
                payment_date: row.get(6)?,
                payment_type: row.get(7)?,
                notes: row.get(8)?,
                created_at: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let payments: Vec<Payment> = rows.filter_map(|r| r.ok()).collect();
    Ok(payments)
}

#[tauri::command]
pub fn record_payment(
    db: State<DbState>,
    payload: RecordPaymentPayload,
) -> Result<Payment, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;

    // Validate amount
    if payload.amount <= 0.0 {
        return Err("Payment amount must be greater than 0".to_string());
    }

    // Get account info
    let (balance, status): (f64, String) = conn
        .query_row(
            "SELECT balance_remaining, status FROM installment_accounts WHERE id = ?1",
            rusqlite::params![payload.account_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("Account {} not found", payload.account_id))?;

    if status != "open" {
        return Err(format!("Cannot record payment: account status is '{}'", status));
    }

    if payload.amount > balance + 0.01 {
        return Err(format!(
            "Payment amount (₱{:.2}) exceeds remaining balance (₱{:.2})",
            payload.amount, balance
        ));
    }

    // Begin transaction
    conn.execute("BEGIN TRANSACTION", rusqlite::params![])
        .map_err(|e| e.to_string())?;

    let result = (|| -> Result<Payment, String> {
        // 1. Insert payment record
        conn.execute(
            "INSERT INTO payments (account_id, schedule_id, amount, payment_date, type, notes)
             VALUES (?1, ?2, ?3, ?4, 'payment', ?5)",
            rusqlite::params![
                payload.account_id,
                payload.schedule_id,
                payload.amount,
                payload.payment_date,
                payload.notes,
            ],
        )
        .map_err(|e| format!("Failed to insert payment: {}", e))?;

        let payment_id = conn.last_insert_rowid();

        // 2. Update account balance
        let new_balance = ((balance - payload.amount) * 100.0).round() / 100.0;
        let new_balance = if new_balance < 0.0 { 0.0 } else { new_balance };

        conn.execute(
            "UPDATE installment_accounts
             SET balance_remaining = ?1, updated_at = datetime('now')
             WHERE id = ?2",
            rusqlite::params![new_balance, payload.account_id],
        )
        .map_err(|e| format!("Failed to update balance: {}", e))?;

        // 3. If schedule_id provided, update that specific schedule entry
        if let Some(sid) = payload.schedule_id {
            apply_payment_to_schedule(&conn, sid, payload.amount)?;
        } else {
            // Auto-apply to earliest overdue/pending schedule entry
            auto_apply_to_schedule(&conn, payload.account_id, payload.amount)?;
        }

        // 4. Auto-close if fully paid
        if new_balance <= 0.0 {
            conn.execute(
                "UPDATE installment_accounts SET status = 'paid', updated_at = datetime('now') WHERE id = ?1",
                rusqlite::params![payload.account_id],
            )
            .map_err(|e| format!("Failed to update status: {}", e))?;

            // Mark remaining schedule entries as paid
            conn.execute(
                "UPDATE payment_schedules SET status = 'paid' WHERE account_id = ?1 AND status != 'paid'",
                rusqlite::params![payload.account_id],
            )
            .map_err(|e| e.to_string())?;
        }

        // Fetch the created payment with JOINs
        let payment = conn
            .query_row(
                "SELECT pay.id, pay.account_id, pay.schedule_id, c.name,
                        COALESCE(
                            (SELECT GROUP_CONCAT(DISTINCT p2.name || COALESCE(' ' || v2.attributes, ''), ', ')
                             FROM sale_items si2
                             JOIN product_variants v2 ON v2.id = si2.variant_id
                             JOIN products p2 ON p2.id = v2.product_id
                             WHERE si2.sale_id = ia.sale_id),
                            'Unknown Product'
                        ),
                        pay.amount, pay.payment_date, pay.type, pay.notes, pay.created_at
                 FROM payments pay
                 JOIN installment_accounts ia ON ia.id = pay.account_id
                 JOIN customers c ON c.id = ia.customer_id
                 WHERE pay.id = ?1",
                rusqlite::params![payment_id],
                |row| {
                    Ok(Payment {
                        id: row.get(0)?,
                        account_id: row.get(1)?,
                        schedule_id: row.get(2)?,
                        customer_name: row.get(3)?,
                        product_summary: row.get(4)?,
                        amount: row.get(5)?,
                        payment_date: row.get(6)?,
                        payment_type: row.get(7)?,
                        notes: row.get(8)?,
                        created_at: row.get(9)?,
                    })
                },
            )
            .map_err(|e| format!("Failed to fetch created payment: {}", e))?;

        Ok(payment)
    })();

    match result {
        Ok(payment) => {
            conn.execute("COMMIT", rusqlite::params![])
                .map_err(|e| e.to_string())?;
            Ok(payment)
        }
        Err(e) => {
            let _ = conn.execute("ROLLBACK", rusqlite::params![]);
            Err(e)
        }
    }
}

fn apply_payment_to_schedule(
    conn: &rusqlite::Connection,
    schedule_id: i64,
    amount: f64,
) -> Result<(), String> {
    let (amount_due, amount_paid): (f64, f64) = conn
        .query_row(
            "SELECT amount_due, amount_paid FROM payment_schedules WHERE id = ?1",
            rusqlite::params![schedule_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| format!("Schedule entry {} not found", schedule_id))?;

    let new_paid = amount_paid + amount;
    let remaining = amount_due - new_paid;

    let new_status = if remaining <= 0.01 {
        "paid"
    } else {
        "partial"
    };

    conn.execute(
        "UPDATE payment_schedules SET amount_paid = ?1, status = ?2 WHERE id = ?3",
        rusqlite::params![new_paid, new_status, schedule_id],
    )
    .map_err(|e| format!("Failed to update schedule entry: {}", e))?;

    // If there's overflow, apply to next entry
    if remaining < -0.01 {
        let overflow = -remaining;
        let next_id: Option<i64> = conn
            .query_row(
                "SELECT id FROM payment_schedules
                 WHERE account_id = (SELECT account_id FROM payment_schedules WHERE id = ?1)
                 AND id > ?1 AND status IN ('pending', 'overdue', 'partial')
                 ORDER BY due_date ASC LIMIT 1",
                rusqlite::params![schedule_id],
                |row| row.get(0),
            )
            .ok();

        if let Some(next) = next_id {
            apply_payment_to_schedule(conn, next, overflow)?;
        }
    }

    Ok(())
}

fn auto_apply_to_schedule(
    conn: &rusqlite::Connection,
    account_id: i64,
    mut remaining_amount: f64,
) -> Result<(), String> {
    // Get schedule entries ordered by due date (overdue first, then pending)
    let mut stmt = conn
        .prepare(
            "SELECT id, amount_due, amount_paid FROM payment_schedules
             WHERE account_id = ?1 AND status IN ('overdue', 'partial', 'pending')
             ORDER BY due_date ASC",
        )
        .map_err(|e| e.to_string())?;

    let entries: Vec<(i64, f64, f64)> = stmt
        .query_map(rusqlite::params![account_id], |row| {
            Ok((row.get(0)?, row.get(1)?, row.get(2)?))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    for (entry_id, amount_due, amount_paid) in entries {
        if remaining_amount <= 0.01 {
            break;
        }

        let entry_remaining = amount_due - amount_paid;
        if entry_remaining <= 0.0 {
            continue;
        }

        let apply = if remaining_amount >= entry_remaining {
            entry_remaining
        } else {
            remaining_amount
        };

        let new_paid = amount_paid + apply;
        let new_status = if (amount_due - new_paid).abs() < 0.01 {
            "paid"
        } else {
            "partial"
        };

        conn.execute(
            "UPDATE payment_schedules SET amount_paid = ?1, status = ?2 WHERE id = ?3",
            rusqlite::params![new_paid, new_status, entry_id],
        )
        .map_err(|e| e.to_string())?;

        remaining_amount -= apply;
    }

    Ok(())
}
