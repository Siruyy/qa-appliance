use tauri::State;

use crate::db::connection::DbState;
use crate::models::payment::{Payment, RecordPaymentPayload, RecordPaymentResult};
use crate::models::PaginatedResult;
use crate::utils::constants::CENTAVO_TOLERANCE;
use crate::utils::query::{build_where, paginated_query};
use crate::commands::audit_log::insert_audit;

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
    let mut param_values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

    if let Some(ref from) = from_date {
        if !from.is_empty() {
            conditions.push(format!("pay.payment_date >= ?{}", param_values.len() + 1));
            param_values.push(Box::new(from.clone()));
        }
    }
    if let Some(ref to) = to_date {
        if !to.is_empty() {
            conditions.push(format!("pay.payment_date <= ?{}", param_values.len() + 1));
            param_values.push(Box::new(format!("{}T23:59:59", to)));
        }
    }
    if let Some(cid) = customer_id {
        conditions.push(format!("ia.customer_id = ?{}", param_values.len() + 1));
        param_values.push(Box::new(cid));
    }
    if let Some(ref s) = search {
        if !s.is_empty() {
            conditions.push(format!("c.name LIKE ?{}", param_values.len() + 1));
            param_values.push(Box::new(format!("%{}%", s)));
        }
    }

    let where_clause = build_where(&conditions);
    let params: Vec<&dyn rusqlite::types::ToSql> =
        param_values.iter().map(|p| p.as_ref()).collect();

    let count_sql = format!(
        "SELECT COUNT(DISTINCT pay.id)
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         JOIN customers c ON c.id = ia.customer_id
         {}",
        where_clause
    );

    let data_sql = format!(
        "SELECT pay.id, pay.account_id, pay.schedule_id, c.name AS customer_name,
                COALESCE(
                    GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, '')),
                    'Unknown Product'
                ) AS product_summary,
                pay.amount, pay.payment_date, pay.type, pay.notes,
                pay.is_reversed, pay.reversed_at, pay.reversed_reason,
                pay.created_at
         FROM payments pay
         JOIN installment_accounts ia ON ia.id = pay.account_id
         JOIN customers c ON c.id = ia.customer_id
         JOIN sales s ON s.id = ia.sale_id
         LEFT JOIN sale_items si ON si.sale_id = s.id
         LEFT JOIN product_variants v ON v.id = si.variant_id
         LEFT JOIN products p ON p.id = v.product_id
         {}
         GROUP BY pay.id
         ORDER BY pay.payment_date DESC, pay.id DESC",
        where_clause
    );

    paginated_query(&conn, &count_sql, &data_sql, &params, limit, offset, |row| {
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
            is_reversed: row.get(9)?,
            reversed_at: row.get(10)?,
            reversed_reason: row.get(11)?,
            created_at: row.get(12)?,
        })
    })
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
                        GROUP_CONCAT(DISTINCT p.name || COALESCE(' ' || v.attributes, '')),
                        'Unknown Product'
                    ) AS product_summary,
                    pay.amount, pay.payment_date, pay.type, pay.notes,
                    pay.is_reversed, pay.reversed_at, pay.reversed_reason,
                    pay.created_at
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
                is_reversed: row.get(9)?,
                reversed_at: row.get(10)?,
                reversed_reason: row.get(11)?,
                created_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let payments: Vec<Payment> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| format!("Row read error: {}", e))?;
    Ok(payments)
}

#[tauri::command]
pub fn record_payment(
    db: State<DbState>,
    payload: RecordPaymentPayload,
) -> Result<RecordPaymentResult, String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

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

    if payload.amount > balance + CENTAVO_TOLERANCE {
        return Err(format!(
            "Payment amount (₱{:.2}) exceeds remaining balance (₱{:.2})",
            payload.amount, balance
        ));
    }

    // Use rusqlite Transaction API for automatic rollback on error
    let tx = conn.transaction().map_err(|e| e.to_string())?;

    // 1. Insert payment record
    tx.execute(
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

    let payment_id = tx.last_insert_rowid();

    // 2. Update account balance
    let new_balance = ((balance - payload.amount) * 100.0).round() / 100.0;
    let new_balance = if new_balance < 0.0 { 0.0 } else { new_balance };

    tx.execute(
        "UPDATE installment_accounts
         SET balance_remaining = ?1, updated_at = datetime('now')
         WHERE id = ?2",
        rusqlite::params![new_balance, payload.account_id],
    )
    .map_err(|e| format!("Failed to update balance: {}", e))?;

    // 3. If schedule_id provided, update that specific schedule entry
    if let Some(sid) = payload.schedule_id {
        apply_payment_to_schedule(&tx, sid, payload.amount)?;
    } else {
        // Auto-apply to earliest overdue/pending schedule entry
        auto_apply_to_schedule(&tx, payload.account_id, payload.amount)?;
    }

    // 4. Auto-close if fully paid
    let mut rebate_credited: f64 = 0.0;
    if new_balance <= 0.0 {
        tx.execute(
            "UPDATE installment_accounts SET status = 'paid', updated_at = datetime('now') WHERE id = ?1",
            rusqlite::params![payload.account_id],
        )
        .map_err(|e| format!("Failed to update status: {}", e))?;

        // Mark remaining schedule entries as paid
        tx.execute(
            "UPDATE payment_schedules SET status = 'paid' WHERE account_id = ?1 AND status != 'paid'",
            rusqlite::params![payload.account_id],
        )
        .map_err(|e| e.to_string())?;

        // Check rebate eligibility: all scheduled payments were on time (no overdue history)
        let rebate_rate: f64 = tx.query_row(
            "SELECT rebate_rate FROM installment_accounts WHERE id = ?1",
            rusqlite::params![payload.account_id],
            |row| row.get(0),
        ).unwrap_or(0.0);

        if rebate_rate > 0.0 {
            // Check if any payment was made after its due date
            let has_late: bool = tx.query_row(
                "SELECT EXISTS(
                    SELECT 1 FROM payments p
                    JOIN payment_schedules ps ON ps.account_id = p.account_id
                    WHERE p.account_id = ?1
                      AND p.type = 'payment'
                      AND p.payment_date > ps.due_date
                      AND ps.status = 'paid'
                )",
                rusqlite::params![payload.account_id],
                |row| row.get(0),
            ).unwrap_or(true);

            // Also check for any penalty history (definitive proof of lateness)
            let has_penalties: bool = tx.query_row(
                "SELECT EXISTS(SELECT 1 FROM payments WHERE account_id = ?1 AND type = 'penalty')",
                rusqlite::params![payload.account_id],
                |row| row.get(0),
            ).unwrap_or(true);

            if !has_late && !has_penalties {
                // Calculate total interest paid
                let _total_interest: f64 = tx.query_row(
                    "SELECT COALESCE(SUM(amount), 0) FROM payments WHERE account_id = ?1 AND type = 'interest_adjustment'",
                    rusqlite::params![payload.account_id],
                    |row| row.get(0),
                ).unwrap_or(0.0);

                // For add-on interest, total interest = principal × monthly_rate × term
                let (principal, interest_rate, term_months): (f64, f64, i64) = tx.query_row(
                    "SELECT principal, interest_rate, term_months FROM installment_accounts WHERE id = ?1",
                    rusqlite::params![payload.account_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
                ).map_err(|e| e.to_string())?;

                let flat_interest = principal * (interest_rate / 100.0) * term_months as f64;
                let rebate_amount = (flat_interest * rebate_rate / 100.0 * 100.0).round() / 100.0;

                if rebate_amount > 0.0 {
                    tx.execute(
                        "INSERT INTO payments (account_id, amount, type, notes)
                         VALUES (?1, ?2, 'rebate', ?3)",
                        rusqlite::params![
                            payload.account_id,
                            -rebate_amount,
                            format!("Early payment rebate: {}% of ₱{:.2} interest", rebate_rate, flat_interest),
                        ],
                    )
                    .map_err(|e| e.to_string())?;

                    // Update balance (will go negative — credit owed to customer)
                    tx.execute(
                        "UPDATE installment_accounts SET balance_remaining = balance_remaining - ?1, updated_at = datetime('now') WHERE id = ?2",
                        rusqlite::params![rebate_amount, payload.account_id],
                    )
                    .map_err(|e| e.to_string())?;

                    rebate_credited = rebate_amount;
                }
            }
        }
    }

    // Fetch the created payment with JOINs
    let payment = tx
        .query_row(
            "SELECT pay.id, pay.account_id, pay.schedule_id, c.name,
                    COALESCE(
                        (SELECT GROUP_CONCAT(DISTINCT p2.name || COALESCE(' ' || v2.attributes, ''))
                         FROM sale_items si2
                         JOIN product_variants v2 ON v2.id = si2.variant_id
                         JOIN products p2 ON p2.id = v2.product_id
                         WHERE si2.sale_id = ia.sale_id),
                        'Unknown Product'
                    ),
                    pay.amount, pay.payment_date, pay.type, pay.notes,
                    pay.is_reversed, pay.reversed_at, pay.reversed_reason,
                    pay.created_at
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
                    is_reversed: row.get(9)?,
                    reversed_at: row.get(10)?,
                    reversed_reason: row.get(11)?,
                    created_at: row.get(12)?,
                })
            },
        )
        .map_err(|e| format!("Failed to fetch created payment: {}", e))?;

    let _ = insert_audit(&tx, "payment_recorded", "payment", Some(payment.id), Some(&format!("₱{:.2} for account #{}", payment.amount, payment.account_id)));
    tx.commit().map_err(|e| e.to_string())?;
    Ok(RecordPaymentResult { payment, rebate_credited })
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

    let new_status = if remaining <= CENTAVO_TOLERANCE {
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
    if remaining < -CENTAVO_TOLERANCE {
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
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Row read error: {}", e))?;

    for (entry_id, amount_due, amount_paid) in entries {
        if remaining_amount <= CENTAVO_TOLERANCE {
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
        let new_status = if (amount_due - new_paid).abs() < CENTAVO_TOLERANCE {
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

#[tauri::command]
pub fn void_payment(db: State<'_, DbState>, payment_id: i64, reason: String) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

    let reason = reason.trim().to_string();
    if reason.is_empty() {
        return Err("Reason is required to void a payment".to_string());
    }

    let (amount, account_id, payment_type, is_reversed): (f64, Option<i64>, String, bool) = conn
        .query_row(
            "SELECT amount, account_id, type, is_reversed FROM payments WHERE id = ?1",
            rusqlite::params![payment_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Payment not found".to_string())?;

    if is_reversed {
        return Err("Payment has already been voided".to_string());
    }

    if payment_type == "penalty" || payment_type == "rebate" {
        return Err(format!("Cannot void a {} entry — use the appropriate action instead", payment_type));
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let now = crate::utils::date::today_iso();
    tx.execute(
        "UPDATE payments SET is_reversed = 1, reversed_at = ?1, reversed_reason = ?2 WHERE id = ?3",
        rusqlite::params![now, reason, payment_id],
    )
    .map_err(|e| e.to_string())?;

    if let Some(acct_id) = account_id {
        tx.execute(
            "UPDATE installment_accounts SET balance_remaining = balance_remaining + ?1, status = 'open' WHERE id = ?2",
            rusqlite::params![amount, acct_id],
        )
        .map_err(|e| e.to_string())?;

        // Reverse schedule entries in LIFO order
        let mut stmt = tx
            .prepare(
                "SELECT id, amount_due, amount_paid FROM payment_schedules
                 WHERE account_id = ?1 AND status IN ('paid', 'partial')
                 ORDER BY due_date DESC",
            )
            .map_err(|e| e.to_string())?;

        let entries: Vec<(i64, f64, f64)> = stmt
            .query_map(rusqlite::params![acct_id], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

        let mut to_reverse = amount;
        for (entry_id, _amount_due, amount_paid) in entries {
            if to_reverse <= 0.0 { break; }
            let deduct = if amount_paid <= to_reverse { amount_paid } else { to_reverse };
            let new_paid = amount_paid - deduct;
            let new_status = if new_paid <= 0.001 { "pending" } else { "partial" };

            tx.execute(
                "UPDATE payment_schedules SET amount_paid = ?1, status = ?2 WHERE id = ?3",
                rusqlite::params![new_paid, new_status, entry_id],
            )
            .map_err(|e| e.to_string())?;

            to_reverse -= deduct;
        }
    }

    tx.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "void_payment",
            "payment",
            payment_id.to_string(),
            format!("Voided payment of ₱{:.2}. Reason: {}", amount, reason)
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn waive_penalty(db: State<'_, DbState>, payment_id: i64, reason: String) -> Result<(), String> {
    let mut conn = db.0.lock().map_err(|e| e.to_string())?;

    let reason = reason.trim().to_string();
    if reason.is_empty() {
        return Err("Reason is required to waive a penalty".to_string());
    }

    let (amount, account_id, payment_type, is_reversed): (f64, Option<i64>, String, bool) = conn
        .query_row(
            "SELECT amount, account_id, type, is_reversed FROM payments WHERE id = ?1",
            rusqlite::params![payment_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
        )
        .map_err(|_| "Payment not found".to_string())?;

    if payment_type != "penalty" {
        return Err("This action is only available for penalty entries".to_string());
    }
    if is_reversed {
        return Err("This penalty has already been waived".to_string());
    }

    let tx = conn.transaction().map_err(|e| e.to_string())?;

    let now = crate::utils::date::today_iso();
    tx.execute(
        "UPDATE payments SET is_reversed = 1, reversed_at = ?1, reversed_reason = ?2 WHERE id = ?3",
        rusqlite::params![now, reason, payment_id],
    )
    .map_err(|e| e.to_string())?;

    // Reduce balance by penalty amount (penalty added to balance, so subtract to undo)
    if let Some(acct_id) = account_id {
        tx.execute(
            "UPDATE installment_accounts SET balance_remaining = balance_remaining - ?1 WHERE id = ?2",
            rusqlite::params![amount, acct_id],
        )
        .map_err(|e| e.to_string())?;
    }

    tx.execute(
        "INSERT INTO audit_log (action, entity_type, entity_id, details) VALUES (?1, ?2, ?3, ?4)",
        rusqlite::params![
            "waive_penalty",
            "payment",
            payment_id.to_string(),
            format!("Waived penalty of ₱{:.2}. Reason: {}", amount, reason)
        ],
    )
    .map_err(|e| e.to_string())?;

    tx.commit().map_err(|e| e.to_string())?;

    Ok(())
}
